import { describe, expect, test, vi } from 'vitest';
import { COUNTRIES, countryName, fetchServedCountry } from './countries';

describe('countryName', () => {
  test('names a slug from the catalog', () => {
    expect(countryName('netherlands')).toBe('Netherlands');
    expect(countryName('south-korea')).toBe(COUNTRIES.find((c) => c.slug === 'south-korea')?.name);
  });

  test('falls back to the slug for a container we do not ship', () => {
    expect(countryName('atlantis')).toBe('atlantis');
  });
});

describe('fetchServedCountry', () => {
  test('reads the country the image lists for itself', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ countries: ['cyprus'] }) });
    expect(await fetchServedCountry('http://x', f as never)).toBe('cyprus');
    expect(f.mock.calls[0][0]).toBe('http://x/countries.json');
  });

  test('answers null rather than throwing when the manifest is missing or odd', async () => {
    const missing = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    expect(await fetchServedCountry('http://x', missing as never)).toBeNull();
    const empty = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ countries: [] }) });
    expect(await fetchServedCountry('http://x', empty as never)).toBeNull();
    const broken = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await fetchServedCountry('http://x', broken as never)).toBeNull();
  });
});
