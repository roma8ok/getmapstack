import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { basemapStyle } from './lib/basemap';
import { contourBounds } from './lib/camera';
import { nextCity, pickCity, type City } from './lib/cities';
import { countryName, fetchServedCountry } from './lib/countries';
import { probeHealth, type ProbeResult } from './lib/health';
import { WaveError, fetchWave, type WaveData } from './lib/isochrones';
import { loadRecording, type Recording } from './lib/recorded';
import { fetchTileJson } from './lib/style';
import { getBase, setBase } from './lib/target';
import * as tl from './lib/timeline';
import Dock from './ui/Dock';
import MapView, { type MapHandle } from './ui/MapView';
import RunPanel from './ui/RunPanel';

type LatLon = { lat: number; lon: number };

const PROBE_REASON_COPY: Record<Exclude<ProbeResult, { ok: true }>['reason'], string> = {
  timeout:
    'nothing answered within 5 seconds - if the browser showed a local-network permission prompt, allow it and retry',
  starting:
    'the container is answering, but its engines are still starting - a large country can take a few minutes, try again in a moment',
  http: 'the address answered, but not like a getmapstack container',
  network: 'the request failed before reaching anything',
};

const LIVE_HINT = 'click anywhere to compute a 15-minute wave from your container';

const inside = (b: number[] | null, p: LatLon) =>
  !!b && p.lon >= b[0] && p.lat >= b[1] && p.lon <= b[2] && p.lat <= b[3];

export default function App() {
  const [city, setCity] = useState<City>(() => pickCity());
  const [recording, setRecording] = useState<Recording | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panel, setPanel] = useState<{ open: boolean; country: string; hasPoint: boolean } | null>(
    null,
  );
  const [timeline, setTimeline] = useState<tl.TimelineState>(tl.initial);
  const tlRef = useRef(tl.initial);
  const mapRef = useRef<MapHandle>(null);
  const [live, setLive] = useState<{ base: string; bounds: number[] | null; country: string } | null>(null);
  const [probe, setProbe] = useState<{ state: 'idle' | 'probing' | 'error'; detail?: string }>({ state: 'idle' });
  // Bumped by every connect attempt and by closing the panel. A probe compares
  // it after each await: a visitor who dismissed the panel must not watch the
  // page replace itself seconds later because a request they abandoned came back.
  const attempt = useRef(0);
  const [wave, setWave] = useState<WaveData | null>(null);
  const [origin, setOrigin] = useState<LatLon | null>(null);
  const [waveError, setWaveError] = useState<string | null>(null);
  const [pending, setPending] = useState<LatLon | null>(null);

  const style = useMemo(
    () => (live ? basemapStyle({ kind: 'container', base: live.base }) : basemapStyle({ kind: 'openfreemap' })),
    [live],
  );

  const setTl = (s: tl.TimelineState) => {
    tlRef.current = s;
    setTimeline(s);
    mapRef.current?.frame(s.t);
  };

  // Load the current city's fixture. Every city change runs this again.
  // Guarded on live: once a container is connected the recording is gone for
  // good, and a later city cycle (there is none - the shuffle button is
  // hidden - but a stray state update should still be inert) must not fetch
  // a fixture that would never be shown.
  useEffect(() => {
    if (live) return;
    let cancelled = false;
    setLoadError(null);
    setRecording(null);
    setTl(tl.startLoading(tlRef.current));
    loadRecording(city.slug)
      .then((rec) => {
        if (cancelled) return;
        setRecording(rec);
        mapRef.current?.resetFollow();
        // Frame the whole fifteen-minute drive before the first frame plays.
        mapRef.current?.frameBounds(contourBounds(rec.wave.car[rec.wave.car.length - 1].geometry));
        // jsdom has no matchMedia at all (not even a stub that answers
        // false), so a plain call throws in tests and would abort this
        // whole load - feature-detect rather than assume every environment
        // has it.
        const reduced =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        setTl(tl.loaded(tlRef.current, !reduced));
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(`${city.name} could not load - try another city`);
        setTl(tl.initial);
      });
    return () => { cancelled = true; };
  }, [city, live]);

  // The animation loop: tick while playing, one frame per rAF.
  useEffect(() => {
    if (timeline.phase !== 'playing') return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setTl(tl.tick(tlRef.current, dt));
      if (tlRef.current.phase === 'playing') raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [timeline.phase]);

  const playPause = () => {
    const s = tlRef.current;
    if (s.phase === 'finished') mapRef.current?.resetFollow();
    setTl(s.phase === 'playing' ? tl.pause(s) : tl.play(s));
  };

  const openPanel = (p?: LatLon) => {
    // A click on the map arrives with the point that was clicked - remember
    // it, so a container connected later can compute its wave without
    // making the visitor click again.
    if (p) setPending(p);
    // The loaded recording is what is actually on screen; it names its own
    // country, which is the one worth pre-filling. Fall back to the picked
    // city while nothing has loaded yet (e.g. a click during the initial load).
    // hasPoint describes THIS opening, not what is remembered: the panel speaks
    // about a point only when the visitor just put one down.
    setPanel({ open: true, country: recording?.country || city.country, hasPoint: !!p });
  };

  const computeWave = async (base: string, p: LatLon) => {
    setOrigin(p);
    setWaveError(null);
    setTl(tl.startLoading(tlRef.current));
    try {
      const data = await fetchWave(base, p);
      setWave(data);
      mapRef.current?.resetFollow();
      mapRef.current?.frameBounds(contourBounds(data.car[data.car.length - 1].geometry));
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTl(tl.loaded(tlRef.current, !reduced));
    } catch (e) {
      setWaveError(e instanceof WaveError ? e.message : 'the engine did not answer');
      setTl(tl.initial);
    }
  };

  const closePanel = () => {
    attempt.current += 1;
    setPanel(null);
    setProbe({ state: 'idle' });
  };

  const connect = async (base: string) => {
    const seq = (attempt.current += 1);
    // What live mode will call itself under the logo. The picked country is the
    // starting guess; the container's own list replaces it below when it answers.
    let country = panel?.country ?? city.country;
    setBase(base);
    setProbe({ state: 'probing' });
    const result = await probeHealth(base);
    if (seq !== attempt.current) return;
    if (!result.ok) {
      setProbe({ state: 'error', detail: PROBE_REASON_COPY[result.reason] });
      return;
    }
    let bounds: number[] | null = null;
    try {
      bounds = (await fetchTileJson(base)).bounds ?? null;
    } catch {
      // Anything that answers /healthz but has no TileJSON to give - a 200 of
      // HTML, most likely - is some other server on that port. The parser's own
      // words ("Unexpected token <") are not an explanation for a visitor.
      if (seq !== attempt.current) return;
      setProbe({ state: 'error', detail: PROBE_REASON_COPY.http });
      return;
    }
    if (seq !== attempt.current) return;
    country = (await fetchServedCountry(base)) ?? country;
    if (seq !== attempt.current) return;
    // The replacement is total: the recording, its city control and its credit
    // all leave with it.
    setRecording(null);
    setLoadError(null);
    setPanel(null);
    setProbe({ state: 'idle' });
    setLive({ base, bounds, country });
    setTl(tl.initial);
    if (bounds) mapRef.current?.frameBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]]);
    // The click made before docker run pays off now - but only once.
    const point = pending;
    setPending(null);
    if (point && inside(bounds, point)) void computeWave(base, point);
  };

  // MapView wires its click handler up once, at mount, and never again (its
  // own comment: "the map is created once; style/wave changes are handled
  // below") - so the function identity handed to it as onPick has to stay
  // the same across every render, while what it DOES has to track the
  // latest live/pending state. useCallback with an empty dependency array
  // gives the stable identity; delegating through a ref gives it the
  // current behavior. Without this, a click after connecting would still
  // run the pre-connect branch captured at mount.
  const onPickRef = useRef<(p: LatLon) => void>(() => {});
  onPickRef.current = (p: LatLon) => {
    if (live) {
      if (tlRef.current.phase !== 'loading') void computeWave(live.base, p);
      return;
    }
    // flushSync exists for App.test.tsx: it calls the captured click handler
    // as a bare function, outside act()/fireEvent, then asserts on the DOM
    // on the very next line with no await - so this update has to commit
    // synchronously right here, or that assertion runs before React
    // re-renders. Without it the panel would still open, just on React's
    // next scheduled render - imperceptible to a person clicking the real
    // map. This is a test-determinism requirement, not a user-facing fix.
    flushSync(() => openPanel(p));
  };
  const onPick = useCallback((p: LatLon) => onPickRef.current(p), []);

  return (
    <div className="stage">
      <MapView
        ref={mapRef}
        style={style}
        bounds={live?.bounds ?? null}
        wave={live ? wave : (recording?.wave ?? null)}
        origin={live ? origin : (recording?.origin ?? null)}
        loading={timeline.phase === 'loading'}
        onPick={onPick}
      />
      <a
        className="brand"
        href="https://github.com/roma8ok/getmapstack"
        target="_blank"
        rel="noreferrer"
        aria-label="getmapstack on GitHub"
      >
        getmapstack
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
      </a>
      {live ? (
        // The badge says whose map this is now. It takes the tagline's slot
        // because the pitch has been made: the visitor is running the thing.
        <p className="badge">{countryName(live.country)}</p>
      ) : (
        /* One description, spelled the same here, in the README and in the
           page's meta tags - a second wording splits the project's identity
           across the surfaces that introduce it. */
        <p className="tagline">Self-hosted mapping stack. One command per country.</p>
      )}
      <div className="topright">
        {live ? (
          <div className="pill"><span className="dot" />{live.base.replace(/^https?:\/\//i, '')}</div>
        ) : (
          <button className="cta" onClick={() => openPanel()}>Run it yourself</button>
        )}
      </div>
      {loadError && <div className="wave-error">{loadError}</div>}
      <Dock
        tl={timeline}
        // The recording date rides in the city row rather than in a corner of
        // the map: a phone hides the corners, and a recorded wave that cannot
        // say it is recorded passes itself off as live.
        city={
          live
            ? null
            : {
                name: recording?.city ?? city.name,
                subtitle: '15 minutes from the centre',
                credit: recording ? `recorded ${recording.snapshot}` : undefined,
              }
        }
        // Live, before the first click, there is no wave to play - so the dock
        // carries the next step instead of a dead transport.
        hint={live && timeline.phase === 'idle' ? LIVE_HINT : null}
        onShuffle={live ? undefined : () => setCity((c) => nextCity(c))}
        shuffleDisabled={timeline.phase === 'loading'}
        onPlayPause={playPause}
        onScrub={(t) => setTl(tl.scrub(tlRef.current, t))}
      />
      {waveError && (
        <div className="wave-error">{waveError}<button onClick={() => setWaveError(null)}>dismiss</button></div>
      )}
      {panel?.open && (
        <RunPanel
          country={panel.country}
          base={getBase()}
          state={probe.state}
          detail={probe.detail}
          hasPoint={panel.hasPoint}
          onCountry={(slug) => setPanel({ ...panel, country: slug })}
          onConnect={connect}
          onClose={closePanel}
        />
      )}
    </div>
  );
}
