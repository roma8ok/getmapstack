import { describe, expect, test } from 'vitest';
import { CITIES, nextCity, pickCity } from './cities';

describe('cities', () => {
  test('carries seven cities with sane origins', () => {
    expect(CITIES).toHaveLength(7);
    for (const c of CITIES) {
      expect(Math.abs(c.origin.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.origin.lon)).toBeLessThanOrEqual(180);
    }
  });

  test('pickCity is driven by the injected rng', () => {
    expect(pickCity(() => 0)).toBe(CITIES[0]);
    expect(pickCity(() => 0.999)).toBe(CITIES[CITIES.length - 1]);
  });

  test('nextCity cycles and never returns the current one', () => {
    let city = CITIES[0];
    const seen = [city.slug];
    for (let i = 0; i < CITIES.length - 1; i++) {
      const next = nextCity(city);
      expect(next.slug).not.toBe(city.slug);
      seen.push(next.slug);
      city = next;
    }
    expect(new Set(seen).size).toBe(CITIES.length);
    expect(nextCity(city).slug).toBe(CITIES[0].slug);
  });
});
