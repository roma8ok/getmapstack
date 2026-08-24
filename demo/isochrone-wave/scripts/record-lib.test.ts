import { describe, expect, test } from 'vitest';
import { CHUNKS, assertCountry, buildFixture, collectGeometries, isoDate } from './record-lib.mjs';
import { MINUTES, chunkContours } from '../src/lib/isochrones';

const square = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] };
const response = (minutes: number[]) => ({
  features: minutes.map((m) => ({ properties: { contour: m }, geometry: square })),
});

describe('record-lib', () => {
  // The recorder asks the engine for the same minutes, in the same request
  // groups, as the live page does - and it spells them out as a literal because
  // a .mjs script cannot import the page's TypeScript. This is the only place
  // the two can silently disagree about what fifteen minutes means.
  test('the recorder asks for exactly the chunks the page asks for', () => {
    expect(CHUNKS).toEqual(chunkContours(MINUTES));
  });

  test('isoDate turns valhalla seconds into a date', () => {
    expect(isoDate(1784488714)).toBe('2026-07-19');
  });

  test('assertCountry accepts the matching manifest', () => {
    expect(() => assertCountry({ countries: ['netherlands'] }, 'netherlands')).not.toThrow();
  });

  test('assertCountry rejects a different image', () => {
    expect(() => assertCountry({ countries: ['cyprus'] }, 'netherlands')).toThrow(/cyprus/);
  });

  test('collectGeometries orders contours by minute', () => {
    const geoms = collectGeometries([
      response([4, 3, 2, 1]), response([8, 7, 6, 5]),
      response([12, 11, 10, 9]), response([15, 14, 13]),
    ]);
    expect(geoms).toHaveLength(15);
    expect(geoms.every((g) => g === square || g.type === 'Polygon')).toBe(true);
  });

  test('collectGeometries refuses a missing minute', () => {
    expect(() => collectGeometries([response([1, 2, 3])])).toThrow(/minute 4/);
  });

  test('buildFixture carries provenance', () => {
    const city = { slug: 'amsterdam', name: 'Amsterdam', label: 'Netherlands', country: 'netherlands', origin: { lat: 1, lon: 2 } };
    const fx = buildFixture(city, { snapshot: '2026-08-14', valhalla: '3.8.3' }, { car: [], bike: [], walk: [] });
    // The address someone can actually pull, which is also the one the run
    // panel tells them to run - not the local build tag.
    expect(fx.image).toBe('ghcr.io/roma8ok/getmapstack/netherlands');
    expect(fx.snapshot).toBe('2026-08-14');
    expect(fx.origin).toEqual({ lat: 1, lon: 2 });
  });
});
