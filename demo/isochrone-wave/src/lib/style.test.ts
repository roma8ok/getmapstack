import { describe, expect, test, vi } from 'vitest';
import { fetchTileJson } from './style';

const BASE = 'http://127.0.0.1:9999';

describe('fetchTileJson', () => {
  test('GETs the basemap TileJSON', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ bounds: [31, 34, 35, 36] }) });
    expect(await fetchTileJson(BASE, f as never)).toEqual({ bounds: [31, 34, 35, 36] });
    expect(f).toHaveBeenCalledWith(`${BASE}/martin/basemap`);
  });
  test('a non-2xx answer throws', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });
    await expect(fetchTileJson(BASE, f as never)).rejects.toThrow('502');
  });
});
