import { getJSON } from "./target.js";

// The bold fontstack the basemap's own labels use, taken from the style once it has
// loaded. The tile server renders a composite stack by concatenating fonts and the order
// decides which one wins a shared codepoint, so the stack is set where the style is
// built - a copy of it written into a tool would draw that tool's labels in a different
// typeface the moment the style changed, silently. Until a style is loaded, and for a
// style whose layers carry no bold stack, the plain family is the safe answer.
let boldStack = ["Noto Sans Bold"];
export const labelFontStack = () => boldStack;

// Martin bakes absolute PUBLIC_URL addresses into the style, and MapLibre fetches
// them exactly as written rather than relative to where the style came from. A
// container opened from another machine would therefore send the browser to its own
// localhost and render a blank map while the rest of the page kept working. Fetch
// the style and point every URL at the Martin base this page derived instead.
export async function loadStyle(martinBase, signal) {
  const style = await getJSON(`${martinBase}/style/bright`, signal);
  const rebase = (url) => {
    if (typeof url !== "string") return url;
    const path = url.replace(/^https?:\/\/[^/]+/, "").replace(/^.*\/martin/, "");
    // Everything the tile server templates today is an absolute origin, so path
    // always starts with "/". Guard anyway: concatenating a relative path would
    // silently produce a URL with no separator and a map that fails to load.
    return path.startsWith("/") ? martinBase + path : url;
  };

  if (style.glyphs) style.glyphs = rebase(style.glyphs);
  if (style.sprite) style.sprite = rebase(style.sprite);
  for (const source of Object.values(style.sources || {})) {
    if (source.url) source.url = rebase(source.url);
    if (Array.isArray(source.tiles)) source.tiles = source.tiles.map(rebase);
  }

  for (const layer of style.layers || []) {
    const font = layer.layout?.["text-font"];
    if (Array.isArray(font) && font.length && /\bBold$/.test(font[font.length - 1])) {
      boldStack = [...font];   // a copy: the style's own array stays the style's
      break;
    }
  }
  return style;
}
