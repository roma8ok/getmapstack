import type { StyleSpec } from './style';
import dark from '../styles/dark.json';

// The OpenFreeMap Dark style, vendored verbatim from
// hyperknot/openfreemap-styles at the commit the server image pins (72e1480),
// picked over Positron and Fiord by eye on a running image. Two bindings
// share this one vendored copy: 'openfreemap' points it back at the public
// host it was designed for (a near-identity rebind - just filling in the
// __TILEJSON_DOMAIN__ placeholder and dropping the unused raster source),
// and 'container' adapts it the same way patch-style.sh adapts bright, so it
// runs against a getmapstack container instead.

export type StyleTarget = { kind: 'openfreemap' } | { kind: 'container'; base: string };

const OFM = 'tiles.openfreemap.org';

// dark asks for circle-11; the bright sprite the image ships names it
// circle_11. Every other icon the style uses exists under its own name.
const renameIcons = (v: unknown): unknown => {
  if (v === 'circle-11') return 'circle_11';
  if (Array.isArray(v)) return v.map(renameIcons);
  return v;
};

export function basemapStyle(target: StyleTarget): StyleSpec {
  const s = structuredClone(dark) as unknown as StyleSpec;
  // ne2_shaded is dropped in both bindings: no layer in this style
  // references it, so keeping it would only add a source nothing draws.
  if (target.kind === 'openfreemap') {
    s.sources = {
      openmaptiles: { type: 'vector', url: `https://${OFM}/planet` },
    };
    s.glyphs = `https://${OFM}/fonts/{fontstack}/{range}.pbf`;
    s.sprite = `https://${OFM}/sprites/ofm_f384/ofm`;
    // No patches: the fontstack reorder, the icon rename, the uppercase
    // removal and the wood-pattern deletion all repair mismatches against
    // OUR image's sprite and fonts. Against the style's native host there is
    // nothing to fix. Attribution arrives from their TileJSON, which
    // MapLibre renders itself.
    return s;
  }

  const { base } = target;
  // No attribution key ON PURPOSE. The image's TileJSON already answers with
  // "© OpenMapTiles © OpenStreetMap contributors" and MapLibre renders that in
  // the attribution control by itself - the same pair the image's own explorer
  // shows. A source spec does not ADD to the TileJSON's attribution, it
  // REPLACES it (MapLibre resolves both through pick(extend(tileJSON,
  // options))), so spelling out the OSM half here would silently drop the
  // OpenMapTiles credit that the vendored style's licence requires.
  s.sources = {
    openmaptiles: {
      type: 'vector',
      url: `${base}/martin/basemap`,
    },
  };
  s.glyphs = `${base}/martin/font/{fontstack}/{range}`;
  s.sprite = `${base}/martin/sprite/bright`;
  for (const raw of s.layers as {
    layout?: Record<string, unknown>;
    paint?: Record<string, unknown>;
  }[]) {
    // The bright sprite has no wood-pattern, and MapLibre skips a fill layer
    // whose pattern image is missing ENTIRELY - warning on every load, woods
    // not drawn. Dropping the pattern lets the layer's own fill-color and
    // opacity ramp carry the woods instead.
    if (raw.paint && raw.paint['fill-pattern'] === 'wood-pattern') delete raw.paint['fill-pattern'];
    const layout = raw.layout;
    if (!layout) continue;
    // Same reasoning as patch-style.sh: the fallbacks go FIRST so each loses
    // every shared codepoint to Noto Sans in Martin's composite fontstack.
    if (Array.isArray(layout['text-font']))
      layout['text-font'] = ['Noto Sans Georgian Regular', 'Noto Sans KR Regular', ...layout['text-font']];
    // Uppercasing Greek keeps the tonos, which Greek orthography drops.
    if (layout['text-transform'] === 'uppercase') delete layout['text-transform'];
    if ('icon-image' in layout) layout['icon-image'] = renameIcons(layout['icon-image']);
  }
  return s;
}
