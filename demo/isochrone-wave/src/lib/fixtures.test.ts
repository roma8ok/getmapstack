import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CITIES } from './cities';
import { imageFor } from './countries';
import { MINUTES } from './isochrones';
import { loadRecording } from './recorded';

// Vite statically recognizes the literal pattern `new URL('...', import.meta.url)` as its
// asset-URL syntax and rewrites it at build time into a dev-server asset reference (it
// fires here because vitest's jsdom environment is browser-like, not SSR) - which breaks
// plain filesystem reads. Hoisting import.meta.url into a variable first keeps this a
// normal runtime URL resolution against the real file, not a bundled asset lookup.
const here = import.meta.url;
const read = (slug: string) =>
  JSON.parse(readFileSync(new URL(`../../public/recorded/${slug}.json`, here), 'utf8'));

describe.each(CITIES.map((c) => [c.slug, c] as const))('fixture %s', (slug, city) => {
  test('loads, carries provenance and grows minute over minute', async () => {
    const body = read(slug);
    const rec = await loadRecording(
      slug,
      (async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch,
      '/',
    );
    expect(rec.city).toBe(city.name);
    expect(rec.label).toBe(city.label);
    expect(rec.country).toBe(city.country);
    expect(rec.image).toBe(imageFor(city.country));
    expect(rec.snapshot).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rec.origin).toEqual(city.origin);
    for (const mode of ['car', 'bike', 'walk'] as const) {
      expect(rec.wave[mode]).toHaveLength(MINUTES.length);
      for (let i = 1; i < MINUTES.length; i++)
        expect(rec.wave[mode][i].areaKm2).toBeGreaterThanOrEqual(rec.wave[mode][i - 1].areaKm2);
    }
    expect(rec.wave.car[14].areaKm2).toBeGreaterThan(rec.wave.walk[14].areaKm2);
  });
});
