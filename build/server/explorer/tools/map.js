import { HttpError, getBlob } from "../target.js";
import * as panel from "../panel.js";

// The object URL of the picture currently on screen, kept so the next run can release
// it. One at a time is all the page ever shows.
let lastShot = null;

// MapLibre fetches raster tiles by itself, on every pan and zoom, outside this page's
// request machinery, so a refused tile never reaches the answer card. That matters
// more than it sounds: the raster layer sits on top of an intact vector basemap, so a
// missing tile does not leave a hole, it reveals the vector map underneath. Measured
// with the tiles deliberately broken - the map looked perfectly normal and the panel
// still reported success.
//
// The map's own "error" event is NOT the signal to use: measured on MapLibre 6.1.0, it
// does not fire at all for failed raster tiles, and isSourceLoaded keeps returning
// true. What does reach this page is the fetch MapLibre performs - all 20 refused
// tiles in the same measurement passed through window.fetch. So wrap fetch once, watch
// only this source's tile URLs, and report a refusal the same way every other tool
// reports one. The static image endpoint does not match the pattern, so it is never
// mistaken for a tile.
const RASTER_TILE = /\/style\/bright\/\d+\/\d+\/\d+\.png/;
let rasterCtx = null;
let watchingRaster = false;

function watchRasterTiles(ctx) {
  // Only the two fields the error path reads. Keeping the run context itself would
  // hold the last visit's abort controller and point set alive for as long as the page
  // is open, because the wrapper below never goes away.
  rasterCtx = { map: ctx.map, curl: ctx.curl };
  if (watchingRaster) return;
  watchingRaster = true;
  const inner = window.fetch;
  // Deliberately not an async function: this wrapper sees every fetch the page makes for
  // the rest of the session, and MapLibre issues one per vector tile, glyph range and
  // sprite - hundreds during a single pan. The uninteresting case returns the original
  // promise untouched rather than paying a second one.
  window.fetch = (...args) => {
    const pending = inner(...args);
    // Only while this tool's layer is actually on the map. The wrapper outlives the
    // tool, so without this check the probe of a later visit - which runs before
    // rasterCtx is refreshed - would overwrite another tool's answer with a raster
    // error and a raster command.
    if (!rasterCtx?.map.getSource("x-raster")) return pending;
    const url =
      typeof args[0] === "string" ? args[0] : args[0]?.url || args[0]?.href || "";
    if (!RASTER_TILE.test(url)) return pending;
    return pending.then((response) => {
      // Checked again on arrival: a tile requested while the layer was up can land after
      // the user has moved on, and that answer is no longer this tool's to overwrite.
      if (!response.ok && rasterCtx?.map.getSource("x-raster")) {
        panel.renderError(
          new HttpError(response.status, "the renderer refused a tile"),
          rasterCtx.curl,
        );
      }
      return response;
    });
  };
}

const staticURL = (ctx) => {
  const c = ctx.map.getCenter();
  const z = Math.round(ctx.map.getZoom());
  return `${ctx.target.martin}/style/bright/static/${c.lng.toFixed(4)},${c.lat.toFixed(4)},${z}/600x400.png`;
};

// The tile MapLibre will ask for anyway. Probing 0/0/0 would render the whole world
// for nobody, spending a heavy render on an image never shown. The source declares
// 512 px tiles, for which MapLibre's tile zoom is the rounded map zoom.
const centreTile = (map) => {
  const z = Math.round(map.getZoom());
  const { lng, lat } = map.getCenter();
  const n = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  return {
    z,
    x: Math.floor(((lng + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n),
  };
};

export const mapTools = [
  {
    id: "static",
    group: "Map",
    label: "Static image",
    method: "GET",
    path: "/style/bright/static/...",
    minPoints: 0,
    maxPoints: 0,
    hint: "Renders the current view server-side, as a PNG, with no JavaScript.",
    controls: () => `<button class="mock-button" data-rerun>render the current view</button>`,
    async execute(ctx) {
      const url = staticURL(ctx);
      const blob = await getBlob(url, ctx.signal);
      // The previous picture's object URL lives as long as the document unless it is
      // released, and every re-run leaks another few hundred KB.
      if (lastShot) URL.revokeObjectURL(lastShot);
      lastShot = URL.createObjectURL(blob);
      return { url, size: blob.size, objectURL: lastShot };
    },
    curl: (ctx) => `curl "${staticURL(ctx)}" -o map.png`,
    render(resp, ctx) {
      panel.renderAnswer({
        ms: ctx.ms,
        size: `${Math.round(resp.size / 1024)} KB`,
        curl: ctx.curl,
        nums: `<div class="num">600&times;400<small>px</small></div>`,
        badges: ["PNG", "no JavaScript needed"],
        detail: `<img class="shot" src="${resp.objectURL}" alt="server-rendered map of the current view">`,
      });
    },
  },
  {
    id: "raster",
    group: "Map",
    label: "Raster layer",
    method: "GET",
    path: "/style/bright/{z}/{x}/{y}.png",
    minPoints: 0,
    maxPoints: 0,
    hint: "The same map, rendered to PNG tiles by the server instead of by the browser.",
    controls: () => "",
    async execute(ctx) {
      // Nothing to fetch by hand: adding the source is the demonstration. Probe the
      // tile under the map's centre - MapLibre fetches that same tile moments later and
      // takes it from the HTTP cache, so the probe is effectively free, and a failure
      // still surfaces in the answer card rather than silently.
      const { z, x, y } = centreTile(ctx.map);
      const blob = await getBlob(
        `${ctx.target.martin}/style/bright/${z}/${x}/${y}.png`, ctx.signal);
      return { bytes: blob.size };
    },
    curl: (ctx) => {
      const { z, x, y } = centreTile(ctx.map);
      return `curl "${ctx.target.martin}/style/bright/${z}/${x}/${y}.png" -o tile.png`;
    },
    render(resp, ctx) {
      watchRasterTiles(ctx);
      ctx.map.addSource("x-raster", {
        type: "raster",
        tiles: [`${ctx.target.martin}/style/bright/{z}/{x}/{y}.png`],
        // The renderer returns 512 px tiles, measured. Declaring 256 would make
        // MapLibre fetch a zoom level deeper and four times as many of them, draw
        // them at half scale against the vector basemap, and spend four times the
        // requests rendering the same view.
        tileSize: 512,
      });
      ctx.map.addLayer({ id: "x-raster", type: "raster", source: "x-raster" });
      panel.renderAnswer({
        ms: ctx.ms,
        size: `${Math.round(resp.bytes / 1024)} KB`,
        curl: ctx.curl,
        nums: `<div class="num">512<small>px tiles</small></div>`,
        badges: ["rendered server-side", "fetched again as you pan"],
        detail: `<div class="hintline">The raster layer is drawn over the vector
          basemap. Switch to another tool to remove it.</div>`,
      });
    },
  },
];
