import { describe, expect, test } from 'vitest';
import countries from './countries.json';

describe('countries.json', () => {
  test('is a non-empty list of name/slug pairs', () => {
    expect(Array.isArray(countries)).toBe(true);
    expect(countries.length).toBeGreaterThan(100);
    for (const c of countries) {
      expect(typeof c.name).toBe('string');
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.slug).toMatch(/^[a-z][a-z-]*[a-z]$/);
    }
  });

  test('is sorted by slug and has no duplicates', () => {
    const slugs = countries.map((c) => c.slug);
    expect(slugs).toEqual([...slugs].sort());
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test('carries the countries the recorded cities need', () => {
    const slugs = countries.map((c) => c.slug);
    for (const s of ['cyprus', 'united-kingdom', 'netherlands', 'kazakhstan', 'kenya', 'south-korea', 'malaysia'])
      expect(slugs).toContain(s);
  });
});
