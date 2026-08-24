import { describe, expect, test, vi } from 'vitest';
import type { Polygon } from 'geojson';
import {
  MINUTES, MODES, WaveError, areaAt, chunkContours, fetchWave,
  type MinuteContour,
} from './isochrones';

describe('chunkContours', () => {
  test('splits 15 ascending minutes into 4+4+4+3', () => {
    expect(chunkContours(MINUTES)).toEqual([
      [1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15],
    ]);
  });
  test('sorts unordered input ascending', () => {
    expect(chunkContours([3, 1, 2])).toEqual([[1, 2, 3]]);
  });
});

// A tiny square around the origin whose side grows with the minute.
const squareFor = (minute: number): Polygon => {
  const d = 0.01 * minute;
  return {
    type: 'Polygon',
    coordinates: [[[-d, -d], [d, -d], [d, d], [-d, d], [-d, -d]]],
  };
};

const okResponse = (minutes: number[]) => ({
  ok: true,
  json: async () => ({
    features: minutes.map((m) => ({
      properties: { contour: m },
      geometry: squareFor(m),
    })),
  }),
});

describe('fetchWave', () => {
  test('12 chunked requests, no Content-Type, ascending contours, no colours', async () => {
    const f = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      return okResponse(body.contours.map((c: { time: number }) => c.time));
    });
    const wave = await fetchWave('http://x', { lat: 35, lon: 33 }, f as never);

    expect(f).toHaveBeenCalledTimes(12);
    for (const [url, init] of f.mock.calls) {
      expect(url).toBe('http://x/valhalla/isochrone');
      expect(init.headers).toBeUndefined();
      const body = JSON.parse(init.body as string);
      expect(body.polygons).toBe(true);
      expect(body.locations).toEqual([{ lat: 35, lon: 33 }]);
      expect(body.contours.length).toBeLessThanOrEqual(4);
      const times = body.contours.map((c: { time: number }) => c.time);
      expect(times).toEqual([...times].sort((a: number, b: number) => a - b));
      for (const c of body.contours) expect(c).not.toHaveProperty('color');
    }
    for (const m of MODES) {
      expect(wave[m.id].map((c) => c.minute)).toEqual(MINUTES);
      const areas = wave[m.id].map((c) => c.areaKm2);
      expect(areas.every((a, i) => i === 0 || a > areas[i - 1])).toBe(true);
    }
  });

  test('one failure is retried', async () => {
    let failed = false;
    const f = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (!failed && body.costing === 'bicycle') {
        failed = true;
        throw new TypeError('Failed to fetch');
      }
      return okResponse(body.contours.map((c: { time: number }) => c.time));
    });
    const wave = await fetchWave('http://x', { lat: 35, lon: 33 }, f as never);
    expect(wave.bike).toHaveLength(15);
    expect(f).toHaveBeenCalledTimes(13);
  });

  test('a second failure surfaces as WaveError', async () => {
    const f = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    await expect(fetchWave('http://x', { lat: 35, lon: 33 }, f as never)).rejects.toBeInstanceOf(WaveError);
  });

  test('the engine error text is preserved', async () => {
    const f = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'No suitable edges near location' }),
    }));
    await expect(fetchWave('http://x', { lat: 0, lon: 0 }, f as never))
      .rejects.toThrow('No suitable edges near location');
  });

  test('a truncated features array surfaces as WaveError', async () => {
    const f = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const requestedMinutes = body.contours.map((c: { time: number }) => c.time);
      // For walk costing, drop minute 7 from the features array
      const minutes = body.costing === 'pedestrian'
        ? requestedMinutes.filter((m: number) => m !== 7)
        : requestedMinutes;
      return okResponse(minutes);
    });
    await expect(fetchWave('http://x', { lat: 35, lon: 33 }, f as never))
      .rejects.toThrow(/minute 7/);
  });
});

describe('areaAt', () => {
  const contours: MinuteContour[] = [10, 20, 30].map((a, i) => ({
    minute: i + 1, geometry: squareFor(i + 1), areaKm2: a,
  }));
  test('zero at t=0', () => expect(areaAt(contours, 0)).toBe(0));
  test('grows toward the first minute', () => expect(areaAt(contours, 30)).toBeCloseTo(5));
  test('linear between minutes', () => expect(areaAt(contours, 90)).toBeCloseTo(15));
  test('clamps past the last minute', () => expect(areaAt(contours, 900)).toBe(30));
});
