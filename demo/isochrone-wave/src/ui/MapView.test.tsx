import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import type { WaveData } from '../lib/isochrones';

// A fake maplibre-gl Map, not the real WebGL engine: this file tests the
// event-ordering state machine (when do sources get installed relative to
// 'style.load' and 'load'), which is decidable without a GPU. The real map
// is still verified by eye against a running image.
const { instances, FakeMap, FakeMarker } = vi.hoisted(() => {
  class FakeMap {
    handlers: Record<string, Array<(e?: unknown) => void>> = {};
    sources: Record<string, unknown> = {};
    layers: Record<string, unknown> = {};
    addSourceCalls: string[] = [];
    setStyleCalls = 0;

    constructor(public opts: unknown) {
      instances.push(this);
    }
    on(event: string, cb: (e?: unknown) => void) {
      (this.handlers[event] ??= []).push(cb);
    }
    emit(event: string, e?: unknown) {
      for (const cb of this.handlers[event] ?? []) cb(e);
    }
    addSource(id: string, spec: unknown) {
      this.sources[id] = spec;
      this.addSourceCalls.push(id);
    }
    removeSource(id: string) {
      delete this.sources[id];
    }
    getSource(id: string) {
      return this.sources[id];
    }
    addLayer(layer: { id: string }) {
      this.layers[layer.id] = layer;
    }
    removeLayer(id: string) {
      delete this.layers[id];
    }
    getLayer(id: string) {
      return this.layers[id];
    }
    getContainer() {
      return { querySelector: () => null };
    }
    fitBounds() {}
    setFeatureState() {}
    setStyle() {
      this.setStyleCalls += 1;
    }
    remove() {}
  }
  class FakeMarker {
    element = { classList: { toggle: () => {} } };
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    getElement() {
      return this.element;
    }
    remove() {}
  }
  const instances: InstanceType<typeof FakeMap>[] = [];
  return { instances, FakeMap, FakeMarker };
});

vi.mock('maplibre-gl', () => ({
  Map: FakeMap,
  Marker: FakeMarker,
  setWorkerUrl: () => {},
}));
// The real module's worker-url wiring imports a `?url` asset via a deep
// maplibre-gl subpath vi.mock('maplibre-gl', ...) does not intercept; none
// of that is needed to test install timing.
vi.mock('../lib/mapWorker', () => ({}));

import MapView, { type MapHandle } from './MapView';

const square: WaveData = {
  car: [{ minute: 1, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }, areaKm2: 1 }],
  bike: [{ minute: 1, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }, areaKm2: 1 }],
  walk: [{ minute: 1, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }, areaKm2: 1 }],
};

const baseProps = {
  bounds: null,
  origin: null,
  loading: false,
  onPick: () => {},
};

beforeEach(() => {
  instances.length = 0;
});
afterEach(() => cleanup());

describe('MapView - wave install timing', () => {
  // The bug this guards: a wave that arrives once the style is already
  // usable, but before MapLibre's 'load' (first full render, which waits on
  // tiles) has fired. Before the fix this window meant the wave was never
  // installed - not delayed, never - because 'style.load' had already fired
  // once (with no wave present) and never fires again for this style.
  test('a wave arriving after the style is loaded, before the map has fully loaded, still gets installed', () => {
    const ref = createRef<MapHandle>();
    // Same style reference on both renders: only `wave` is under test here,
    // and a changed style reference would itself trigger the basemap-swap
    // effect (setStyle invalidates styleReady), confounding the assertion.
    const style = {};
    const { rerender } = render(
      <MapView ref={ref} style={style} wave={null} {...baseProps} />,
    );
    const map = instances[0];
    // The style is usable now ('style.load' fired); 'load' - the full-render
    // event - never fires in this test, reproducing the real gap where it
    // fires late.
    map.emit('style.load');
    expect(map.addSourceCalls).toHaveLength(0); // nothing to install yet

    rerender(<MapView ref={ref} style={style} wave={square} {...baseProps} />);

    expect(map.addSourceCalls).toEqual(
      expect.arrayContaining(['wave-car', 'wave-bike', 'wave-walk']),
    );
  });

  // The invariant the fix must not break: a wave that arrives before the
  // style is ready at all is not installed early (MapLibre throws on
  // addSource before the style has loaded) - it waits for style.load.
  test('a wave arriving before the style is ready is picked up by style.load', () => {
    const ref = createRef<MapHandle>();
    const style = {};
    const { rerender } = render(
      <MapView ref={ref} style={style} wave={null} {...baseProps} />,
    );
    const map = instances[0];

    rerender(<MapView ref={ref} style={style} wave={square} {...baseProps} />);
    expect(map.addSourceCalls).toHaveLength(0); // correctly deferred

    map.emit('style.load');
    expect(map.addSourceCalls).toEqual(
      expect.arrayContaining(['wave-car', 'wave-bike', 'wave-walk']),
    );
  });

  // The other invariant named alongside the fix: a basemap switch tears
  // down the wave sources (setStyle) and the persistent style.load handler
  // must re-add them once the new style has loaded.
  test('a basemap switch re-installs the wave once the new style loads', () => {
    const ref = createRef<MapHandle>();
    const { rerender } = render(
      <MapView ref={ref} style={{ id: 'a' }} wave={square} {...baseProps} />,
    );
    const map = instances[0];
    map.emit('style.load');
    expect(map.addSourceCalls.filter((id) => id === 'wave-car')).toHaveLength(1);

    rerender(<MapView ref={ref} style={{ id: 'b' }} wave={square} {...baseProps} />);
    expect(map.setStyleCalls).toBe(1);

    map.emit('style.load');
    expect(map.addSourceCalls.filter((id) => id === 'wave-car')).toHaveLength(2);
  });
});
