import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
// maplibre-gl 6.5.0 ships ESM-only with no default export - Map and Marker
// are named exports, so there is no `maplibregl` namespace object to hang
// them off of.
import { Map as MlMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../lib/mapWorker';
import { contourBounds } from '../lib/camera';
import { MODE_ORDER, type WaveData } from '../lib/isochrones';
import { applyFrame, waveLayers, waveSources } from '../wave/layers';

export type MapHandle = {
  frame(t: number): void;
  resetFollow(): void;
  // Frame a place immediately: a newly loaded recording, or the country of a
  // container that was just connected.
  frameBounds(b: [[number, number], [number, number]]): void;
};

type Props = {
  style: unknown;
  bounds: number[] | null;
  wave: WaveData | null;
  origin: { lat: number; lon: number } | null;
  loading: boolean;
  onPick: (p: { lat: number; lon: number }) => void;
};

function resetWave(map: MlMap, wave: WaveData) {
  const sources = waveSources(wave);
  for (const layer of waveLayers()) if (map.getLayer(layer.id)) map.removeLayer(layer.id);
  for (const [id] of Object.entries(sources)) if (map.getSource(id)) map.removeSource(id);
  for (const [id, spec] of Object.entries(sources)) map.addSource(id, spec as never);
  for (const layer of waveLayers()) map.addLayer(layer as never);
}

const MapView = forwardRef<MapHandle, Props>(function MapView(
  { style, bounds, wave, origin, loading, onPick },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const ready = useRef(false);
  // True once 'style.load' has fired for the CURRENT style: MapLibre sets
  // its internal "loaded" flag - the one addSource/addLayer actually check -
  // synchronously before firing that event, well before 'load' (the first
  // full render, which additionally waits on every source's tiles).
  // map.isStyleLoaded() is a stricter, later check: it requires all of
  // THOSE tiles too, so it does not distinguish this case from ready.current.
  const styleReady = useRef(false);
  const follow = useRef(true);
  const lastMinute = useRef(0);
  // The wave's opacities live in feature-state, which setStyle wipes along
  // with the sources. While playing, the next rAF frame repaints it, but a
  // basemap switch on a paused or finished wave has no next frame - so every
  // resetWave replays the last frame explicitly.
  const lastT = useRef(0);
  const waveRef = useRef<WaveData | null>(null);
  waveRef.current = wave;

  useEffect(() => {
    const map = new MlMap({
      container: container.current!,
      style: style as never,
      bounds: (bounds as never) ?? undefined,
      fitBoundsOptions: { padding: 40 },
      // Collapsed to the disc at every width: the ODbL notice is one click
      // away rather than a bar across the map. app.css darkens it - MapLibre's
      // own is a white pill, louder on this basemap than the text it hides.
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.on('load', () => {
      ready.current = true;
      // compact means "collapsible", not "collapsed": MapLibre opens the
      // attribution on first paint and only folds it away on the first drag.
      // Dropping the class is that same fold, done once and up front; the
      // control re-adds it on no later event, and the button still toggles.
      map
        .getContainer()
        .querySelector('.maplibregl-ctrl-attrib')
        ?.classList.remove('maplibregl-compact-show');
    });
    // Persistent, not once(): every full style load re-adds the wave. The
    // matching setStyle below passes diff:false, because a successful diff
    // never fires style.load and a once() handler would dangle until some
    // later full load - the wave would vanish on one switch and reappear on
    // the next.
    map.on('style.load', () => {
      styleReady.current = true;
      if (waveRef.current) {
        resetWave(map, waveRef.current);
        applyFrame(map, lastT.current);
      }
    });
    map.on('click', (e) => onPick({ lat: e.lngLat.lat, lon: e.lngLat.lng }));
    for (const ev of ['dragstart', 'zoomstart', 'rotatestart'] as const)
      map.on(ev, (e) => {
        if ((e as { originalEvent?: unknown }).originalEvent) follow.current = false;
      });
    return () => {
      ready.current = false;
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; style/wave changes are handled below.
  }, []);

  // Basemap swap: setStyle destroys custom sources and layers; the map's
  // persistent style.load handler re-adds the wave once the new style is in.
  const firstStyle = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (firstStyle.current) {
      firstStyle.current = false;
      return;
    }
    // Invalidated until the new style's own 'style.load' fires and sets it
    // again (see the persistent handler above). MapLibre always defers that
    // event past this call, even for an in-memory style object, so every
    // setStyle leaves a window in which the wave cannot be installed - the
    // handler above is what closes it.
    styleReady.current = false;
    map.setStyle(style as never, { diff: false });
  }, [style]);

  // New wave data: rebuild sources and layers, restart the follow camera.
  // Gated on styleReady, NOT ready.current or map.isStyleLoaded(): a
  // recorded fixture now arrives within milliseconds of mount, inside the
  // window after 'style.load' has fired but before 'load' (the first full
  // render, which waits on tiles) has - gating on ready.current missed that
  // window every time, because 'style.load' had already fired once with no
  // wave to install and never fires again for this style. isStyleLoaded()
  // is not a fix either: it is a stricter, later check than 'style.load'
  // (it additionally waits for every source's tiles), so it lands in the
  // same missed window.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !wave) return;
    if (styleReady.current) {
      resetWave(map, wave);
      applyFrame(map, lastT.current);
    }
    // else: the pending style.load handler above re-adds the wave itself
    follow.current = true;
    lastMinute.current = 0;
  }, [wave]);

  // Origin marker: a DOM marker survives style swaps by itself.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!origin) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const el = document.createElement('div');
      el.className = 'origin-marker';
      markerRef.current = new Marker({ element: el });
      markerRef.current.setLngLat([origin.lon, origin.lat]).addTo(map);
    } else {
      markerRef.current.setLngLat([origin.lon, origin.lat]);
    }
    markerRef.current.getElement().classList.toggle('loading', loading);
  }, [origin, loading]);

  useImperativeHandle(ref, () => ({
    frame(t: number) {
      lastT.current = t;
      const map = mapRef.current;
      const data = waveRef.current;
      if (!map || !ready.current || !data) return;
      // A basemap switch mid-run calls setStyle, which drops the wave
      // sources until the pending style.load re-adds them (see the effect
      // above). Skip this frame rather than spam setFeatureState against a
      // source that is momentarily gone - the next frame after style.load
      // picks the animation back up with no visible gap.
      if (!MODE_ORDER.every((m) => map.getSource(`wave-${m}`))) return;
      applyFrame(map, t);
      const minute = Math.min(15, Math.floor(t / 60));
      if (minute >= 1 && minute !== lastMinute.current) {
        lastMinute.current = minute;
        if (follow.current)
          map.fitBounds(contourBounds(data.car[minute - 1].geometry), {
            padding: 90,
            duration: 900,
            maxZoom: 14,
          });
      }
    },
    resetFollow() {
      follow.current = true;
      lastMinute.current = 0;
    },
    frameBounds(b) {
      mapRef.current?.fitBounds(b, { padding: 90, duration: 900, maxZoom: 14 });
    },
  }));

  return <div className="map" ref={container} />;
});

export default MapView;
