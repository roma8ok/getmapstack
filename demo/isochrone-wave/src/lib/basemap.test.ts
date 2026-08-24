import { describe, expect, test } from 'vitest';
import rawDark from '../styles/dark.json';
import { basemapStyle } from './basemap';

const BASE = 'http://127.0.0.1:9999';

type Layer = {
  id: string;
  source?: string;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
};

const layers = () => basemapStyle({ kind: 'container', base: BASE }).layers as Layer[];

describe('basemapStyle', () => {
  test('single vector source pointing at the container', () => {
    const s = basemapStyle({ kind: 'container', base: BASE });
    expect(Object.keys(s.sources)).toEqual(['openmaptiles']);
    expect(s.sources.openmaptiles).toMatchObject({
      type: 'vector',
      url: `${BASE}/martin/basemap`,
    });
  });

  // The image's TileJSON answers with "© OpenMapTiles © OpenStreetMap
  // contributors" - both credits, the OpenMapTiles one required by the style's
  // own licence. MapLibre resolves a source's attribution as
  // pick(extend(tileJSON, options)), so anything set here REPLACES that pair
  // rather than adding to it. Leaving it unset is what keeps the credit.
  test('leaves attribution to the container TileJSON', () => {
    const s = basemapStyle({ kind: 'container', base: BASE });
    expect('attribution' in s.sources.openmaptiles).toBe(false);
  });

  test('every layer draws from that source', () => {
    for (const l of layers()) if (l.source !== undefined) expect(l.source).toBe('openmaptiles');
  });

  test('glyphs and sprite come from the container', () => {
    const s = basemapStyle({ kind: 'container', base: BASE });
    expect(s.glyphs).toBe(`${BASE}/martin/font/{fontstack}/{range}`);
    expect(s.sprite).toBe(`${BASE}/martin/sprite/bright`);
  });

  test('Georgian and KR fonts are prepended, upstream stack kept', () => {
    const stacks = layers()
      .map((l) => l.layout?.['text-font'])
      .filter((f): f is string[] => Array.isArray(f));
    expect(stacks.length).toBeGreaterThan(0);
    for (const f of stacks) {
      expect(f.slice(0, 2)).toEqual(['Noto Sans Georgian Regular', 'Noto Sans KR Regular']);
      expect(f.length).toBeGreaterThan(2);
    }
  });

  test('no uppercase text-transform survives', () => {
    for (const l of layers()) expect(l.layout?.['text-transform']).not.toBe('uppercase');
  });

  test('upstream dark does uppercase, so the removal is real', () => {
    const raw = rawDark.layers as Layer[];
    expect(raw.some((l) => l.layout?.['text-transform'] === 'uppercase')).toBe(true);
  });

  test('the wood pattern is dropped, its fill-color kept', () => {
    const raw = rawDark.layers as Layer[];
    expect(raw.some((l) => l.paint?.['fill-pattern'] === 'wood-pattern')).toBe(true);
    const wood = layers().find((l) => l.id === 'landcover_wood')!;
    expect(wood.paint?.['fill-pattern']).toBeUndefined();
    expect(wood.paint?.['fill-color']).toBeDefined();
  });

  test('circle-11 is renamed to the bright sprite name', () => {
    const dump = JSON.stringify(layers());
    expect(dump).not.toContain('"circle-11"');
    expect(dump).toContain('"circle_11"');
  });

  test('does not mutate the vendored style', () => {
    const before = JSON.stringify(rawDark);
    basemapStyle({ kind: 'container', base: BASE });
    expect(JSON.stringify(rawDark)).toBe(before);
  });

  test('each call adapts to its own base', () => {
    const a = basemapStyle({ kind: 'container', base: 'http://a:1' });
    const b = basemapStyle({ kind: 'container', base: 'http://b:2' });
    expect(a.glyphs).toBe('http://a:1/martin/font/{fontstack}/{range}');
    expect(b.glyphs).toBe('http://b:2/martin/font/{fontstack}/{range}');
  });
});

describe('basemapStyle - openfreemap', () => {
  const s = basemapStyle({ kind: 'openfreemap' });

  test('points every URL at the public host', () => {
    expect(s.sources.openmaptiles.url).toBe('https://tiles.openfreemap.org/planet');
    expect(s.glyphs).toBe('https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf');
    expect(s.sprite).toBe('https://tiles.openfreemap.org/sprites/ofm_f384/ofm');
    expect(JSON.stringify(s)).not.toContain('__TILEJSON_DOMAIN__');
  });

  test('drops the raster source no layer draws', () => {
    expect(Object.keys(s.sources)).toEqual(['openmaptiles']);
  });

  test('applies none of the container patches', () => {
    const fonts = (s.layers as { layout?: Record<string, unknown> }[])
      .map((l) => l.layout?.['text-font'])
      .filter(Boolean) as string[][];
    expect(fonts.length).toBeGreaterThan(0);
    for (const f of fonts) expect(f[0]).toBe('Noto Sans Regular');
    const uppercase = (s.layers as { layout?: Record<string, unknown> }[])
      .some((l) => l.layout?.['text-transform'] === 'uppercase');
    expect(uppercase).toBe(true);
  });
});

describe('basemapStyle - container', () => {
  const s = basemapStyle({ kind: 'container', base: 'http://localhost:4326' });

  test('routes through the container gateway', () => {
    expect(s.sources.openmaptiles.url).toBe('http://localhost:4326/martin/basemap');
    expect(s.glyphs).toBe('http://localhost:4326/martin/font/{fontstack}/{range}');
    expect(s.sprite).toBe('http://localhost:4326/martin/sprite/bright');
    expect(Object.keys(s.sources)).toEqual(['openmaptiles']);
  });

  test('keeps the fallback fonts first', () => {
    const first = (s.layers as { layout?: Record<string, unknown> }[])
      .map((l) => l.layout?.['text-font'] as string[] | undefined)
      .find(Boolean)!;
    expect(first.slice(0, 2)).toEqual(['Noto Sans Georgian Regular', 'Noto Sans KR Regular']);
  });
});
