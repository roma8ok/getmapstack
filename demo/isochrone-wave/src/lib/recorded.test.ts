import { describe, expect, test, vi } from 'vitest';
import { MINUTES } from './isochrones';
import { RecordingError, loadRecording } from './recorded';

const square = (size: number) => ({
  type: 'Polygon' as const,
  coordinates: [[[0, 0], [size, 0], [size, size], [0, size], [0, 0]]],
});

const fixture = (overrides: Record<string, unknown> = {}) => ({
  city: 'Amsterdam',
  label: 'Netherlands',
  country: 'netherlands',
  image: 'getmapstack/netherlands',
  snapshot: '2026-08-14',
  valhalla: '3.8.3',
  origin: { lat: 52.3728, lon: 4.8936 },
  modes: {
    car: MINUTES.map((m) => square(m * 0.03)),
    bike: MINUTES.map((m) => square(m * 0.01)),
    walk: MINUTES.map((m) => square(m * 0.004)),
  },
  ...overrides,
});

const okFetch = (body: unknown) =>
  vi.fn(async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch;

describe('loadRecording', () => {
  test('fetches under the base url and returns a WaveData', async () => {
    const f = okFetch(fixture());
    const rec = await loadRecording('amsterdam', f, '/getmapstack/');
    expect((f as unknown as { mock: { calls: string[][] } }).mock.calls[0][0])
      .toBe('/getmapstack/recorded/amsterdam.json');
    expect(rec.city).toBe('Amsterdam');
    expect(rec.origin).toEqual({ lat: 52.3728, lon: 4.8936 });
    expect(rec.wave.car).toHaveLength(15);
    expect(rec.wave.car[0].minute).toBe(1);
    expect(rec.wave.car[14].areaKm2).toBeGreaterThan(rec.wave.car[0].areaKm2);
    expect(rec.wave.walk[0].areaKm2).toBeGreaterThan(0);
  });

  test('rejects a fixture with a missing mode', async () => {
    const bad = fixture();
    delete (bad.modes as Record<string, unknown>).walk;
    await expect(loadRecording('amsterdam', okFetch(bad))).rejects.toBeInstanceOf(RecordingError);
  });

  test('rejects a fixture with the wrong number of contours', async () => {
    const bad = fixture();
    bad.modes.car = bad.modes.car.slice(0, 14);
    await expect(loadRecording('amsterdam', okFetch(bad))).rejects.toBeInstanceOf(RecordingError);
  });

  test('rejects an empty polygon', async () => {
    const bad = fixture();
    bad.modes.bike[3] = { type: 'Polygon', coordinates: [] };
    await expect(loadRecording('amsterdam', okFetch(bad))).rejects.toBeInstanceOf(RecordingError);
  });

  test('rejects a fixture with a missing or malformed origin', async () => {
    const missing = fixture({ origin: undefined });
    await expect(loadRecording('amsterdam', okFetch(missing))).rejects.toBeInstanceOf(RecordingError);

    const malformed = fixture({ origin: { lat: 'north', lon: 4.8936 } });
    await expect(loadRecording('amsterdam', okFetch(malformed))).rejects.toBeInstanceOf(RecordingError);
  });

  test('turns an HTTP failure into a RecordingError', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch;
    await expect(loadRecording('amsterdam', f)).rejects.toBeInstanceOf(RecordingError);
  });
});
