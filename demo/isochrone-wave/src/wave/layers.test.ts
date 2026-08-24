import { describe, expect, test, vi } from 'vitest';
import type { Polygon } from 'geojson';
import { MINUTES, MODE_ORDER, type WaveData } from '../lib/isochrones';
import { applyFrame, frameStates, waveLayers, waveSources } from './layers';

const geometry: Polygon = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
const wave: WaveData = Object.fromEntries(
  MODE_ORDER.map((m) => [m, MINUTES.map((minute) => ({ minute, geometry, areaKm2: minute }))]),
) as WaveData;

describe('waveSources', () => {
  const sources = waveSources(wave) as Record<string, {
    type: string; promoteId: string;
    data: { features: { properties: { minute: number } }[] };
  }>;
  test('one geojson source per mode with promoteId minute', () => {
    expect(Object.keys(sources)).toEqual(['wave-car', 'wave-bike', 'wave-walk']);
    for (const s of Object.values(sources)) {
      expect(s.type).toBe('geojson');
      expect(s.promoteId).toBe('minute');
      expect(s.data.features.map((f) => f.properties.minute)).toEqual(MINUTES);
    }
  });
});

describe('waveLayers', () => {
  test('fills below glows below fronts, one triple per mode', () => {
    const ids = waveLayers().map((l) => l.id);
    expect(ids).toEqual([
      'wave-fill-car', 'wave-fill-bike', 'wave-fill-walk',
      'wave-glow-car', 'wave-glow-bike', 'wave-glow-walk',
      'wave-front-car', 'wave-front-bike', 'wave-front-walk',
    ]);
  });
  test('every opacity reads feature-state through coalesce', () => {
    for (const l of waveLayers()) {
      const paint = l.paint as Record<string, unknown>;
      const opacity = JSON.stringify(paint['fill-opacity'] ?? paint['line-opacity']);
      expect(opacity).toContain('"feature-state"');
      expect(opacity).toContain('"coalesce"');
    }
  });
});

describe('frameStates', () => {
  const at = (t: number, minute: number) => frameStates(t).find((s) => s.minute === minute)!;
  test('all dark at t=0', () => {
    expect(frameStates(0).every((s) => s.fill === 0 && s.front === 0)).toBe(true);
  });
  test('first minute blooms in', () => {
    expect(at(30, 1)).toEqual({ minute: 1, fill: 0.5, front: 0.5 });
  });
  test('crossfade at half past minute four', () => {
    expect(at(270, 4).fill).toBeCloseTo(0.5);
    expect(at(270, 5).fill).toBeCloseTo(0.5);
    expect(at(270, 3).front).toBeCloseTo(0.25); // ghost 1
    expect(at(270, 2).front).toBeCloseTo(0.12); // ghost 2
    expect(at(270, 1).front).toBeCloseTo(0.05); // ghost 3
    expect(at(270, 6).fill).toBe(0);
  });
  test('final state holds the last contour', () => {
    expect(at(900, 15)).toEqual({ minute: 15, fill: 1, front: 1 });
    expect(at(900, 14).front).toBeCloseTo(0.25);
  });
  test('always returns all fifteen minutes', () => {
    expect(frameStates(432).map((s) => s.minute)).toEqual(MINUTES);
  });
});

describe('applyFrame', () => {
  test('sets state for every mode and minute', () => {
    const setFeatureState = vi.fn();
    applyFrame({ setFeatureState }, 270);
    expect(setFeatureState).toHaveBeenCalledTimes(45);
    expect(setFeatureState).toHaveBeenCalledWith(
      { source: 'wave-car', id: 4 },
      { fill: expect.closeTo(0.5), front: expect.closeTo(0.5) },
    );
  });
});
