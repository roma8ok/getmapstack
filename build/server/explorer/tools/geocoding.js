import { getJSON } from "../target.js";
import * as panel from "../panel.js";
import { advancedBlock, advCheck, advNumber, advPick } from "../options.js";
import { labelFontStack } from "../style.js";

// Every geocoding field lives here rather than in the DOM, because the parameter card is
// rebuilt on each tool switch and a query typed into it would otherwise be lost on the
// way to another tool and back.
const geo = {
  q: "Nicosia",
  limit: "10",
  lang: "",
  layer: "",
  osm_tag: "",
  bbox: false,
  bias: false,
  radius: "",
  city: "Nicosia",
  street: "",
  postcode: "",
};

document.addEventListener("change", (e) => {
  const f = e.target.closest("[data-geo]");
  if (!f) return;
  geo[f.dataset.geo] = f.type === "checkbox" ? f.checked : f.value;
}, true);

// The languages the index was actually built with - asking for one outside that list is
// a 400 from the engine, not a silent fallback.
const LANGS = ["", "en", "de", "fr", "el", "ru", "uk", "es", "it", "pt", "nl", "pl",
  "zh", "ja", "ko", "ar"];
// The engine's own layer names. Anything else is a 400.
const LAYERS = ["", "house", "street", "locality", "district", "city", "county", "state",
  "country", "other"];

const pick = (key, options, label) => advPick("data-geo", key, options, label, geo[key]);
const number = (key, label, extra = "") => advNumber("data-geo", key, label, geo[key], extra);
const check = (key, label) => advCheck("data-geo", key, label, geo[key]);

// Every geocoding tool offers the same three engine-wide arguments, in the same order,
// above whatever else it takes. Written once so a tool cannot quietly lose one.
const geoAdvanced = (extra = "") => advancedBlock(
  number("limit", "limit", 'min="1" max="50" step="1"') +
  pick("lang", LANGS, "language") +
  pick("layer", LAYERS, "layer") +
  extra,
  false);

// bbox filters, the lat/lon pair only re-ranks - so the two are offered separately
// rather than as one "search here" switch that would hide which of them did the work.
const viewParams = (params, map) => {
  if (geo.bbox) {
    const b = map.getBounds();
    params.set("bbox", [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
      .map((n) => n.toFixed(5)).join(","));
  }
  if (geo.bias) {
    const c = map.getCenter();
    params.set("lat", c.lat.toFixed(5));
    params.set("lon", c.lng.toFixed(5));
    params.set("zoom", String(Math.round(map.getZoom())));
  }
};

const common = (params) => {
  if (geo.lang) params.set("lang", geo.lang);
  if (geo.layer) params.set("layer", geo.layer);
};

function drawPins(map, features, fit = false) {
  // The label is computed once and carried in the feature, so the map layer and the
  // list below the answer cannot disagree about what a result is called.
  const data = {
    type: "FeatureCollection",
    features: features.map((f) => ({
      ...f,
      properties: { ...f.properties, label: label(f.properties) },
    })),
  };
  map.addSource("x-pins", { type: "geojson", data });
  map.addLayer({
    id: "x-pins",
    type: "circle",
    source: "x-pins",
    paint: { "circle-radius": 6, "circle-color": "#1f6feb", "circle-stroke-width": 2, "circle-stroke-color": "#fff" },
  });
  // The fontstack is read out of the loaded style rather than restated here: the tile
  // server renders a composite stack by concatenating fonts, so a stack in a different
  // order would draw the labels in a different typeface from the basemap underneath
  // them - and the order is decided where the style is built, not here. Bold and in the
  // pins' own colour, because a black label is exactly what the basemap already draws
  // everywhere - results have to be told apart from the map they sit on, not blend into
  // it. The halo is what carries them over roads and landuse fills.
  map.addLayer({
    id: "x-pins-label",
    type: "symbol",
    source: "x-pins",
    layout: {
      "text-field": ["get", "label"],
      "text-font": labelFontStack(),
      "text-size": 12.5,
      "text-offset": [0, 0.9],
      "text-anchor": "top",
      "text-padding": 4,
    },
    paint: {
      "text-color": "#123f8c",
      "text-halo-color": "#ffffff",
      "text-halo-width": 2.4,
    },
  });
  if (fit && features.length) fitTo(map, features);
}

// Frames every result at once, which is the only way to see that a search returned
// places on opposite ends of the country. maxZoom keeps a single result from zooming
// to the maximum, where nothing around it is recognisable.
function fitTo(map, features) {
  const lons = features.map((f) => f.geometry.coordinates[0]);
  const lats = features.map((f) => f.geometry.coordinates[1]);
  map.fitBounds(
    [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
    { padding: 60, maxZoom: 15, duration: 400 },
  );
}

// Photon results do not always carry a name: a building answers with housenumber
// and street instead, so label from whatever is present rather than assuming name.
const label = (p) =>
  p.name || [p.housenumber, p.street].filter(Boolean).join(" ") || p.city || p.country || "unnamed";

const resultDetail = (features) =>
  `<ul class="steps">${features
    .slice(0, 5)
    .map((f) => `<li><i>&#9670;</i>${panel.esc(label(f.properties))}<span class="co">${panel.esc(f.properties.osm_value || "")}</span></li>`)
    .join("")}</ul>`;

const renderResults = (resp, ctx) => {
  drawPins(ctx.map, resp.features, true);
  panel.renderAnswer({
    ms: ctx.ms,
    raw: resp,
    curl: ctx.curl,
    nums: `<div class="num">${resp.features.length}<small>results</small></div>`,
    badges: [],
    detail: resultDetail(resp.features),
  });
};

// Every geocoding tool is one GET against a URL it builds itself, so the request and the
// command shown beside it are derived from that one url() rather than written out per
// tool - which is what stops them from describing different queries.
const photonTool = (tool) => ({
  method: "GET",
  minPoints: 0,
  maxPoints: 0,
  ...tool,
  execute(ctx) {
    return getJSON(this.url(ctx), ctx.signal);
  },
  curl(ctx) {
    return `curl "${this.url(ctx)}"`;
  },
});

export const geocodingTools = [
  photonTool({
    id: "search",
    group: "Geocoding",
    label: "Search",
    path: "/api",
    hint: "Type a place name. Results appear as pins.",
    controls: () =>
      `<div class="field"><input type="text" data-geo="q" placeholder="Nicosia" value="${panel.escAttr(geo.q)}"></div>`,
    advanced: () => geoAdvanced(
      `<label class="adv-row"><span>osm_tag</span>
        <input type="text" data-geo="osm_tag" value="${panel.escAttr(geo.osm_tag)}" placeholder="amenity:cafe"></label>` +
      check("bbox", "only inside the map view") +
      check("bias", "prefer results near the map centre")),
    url(ctx) {
      const params = new URLSearchParams({ q: geo.q, limit: geo.limit || "10" });
      common(params);
      if (geo.osm_tag) params.set("osm_tag", geo.osm_tag);
      viewParams(params, ctx.map);
      return `${ctx.target.photon}/api?${params}`;
    },
    render: renderResults,
  }),
  photonTool({
    id: "structured",
    group: "Geocoding",
    label: "Structured",
    path: "/structured",
    hint: "Search by fields instead of one string.",
    controls: () => `
      <div class="field"><label>city</label><input type="text" data-geo="city" value="${panel.escAttr(geo.city)}"></div>
      <div class="field"><label>street</label><input type="text" data-geo="street" value="${panel.escAttr(geo.street)}"></div>
      <div class="field"><label>postcode</label><input type="text" data-geo="postcode" value="${panel.escAttr(geo.postcode)}"></div>`,
    advanced: () => geoAdvanced(),
    url(ctx) {
      const params = new URLSearchParams({ limit: geo.limit || "10" });
      for (const key of ["city", "street", "postcode"]) {
        if (geo[key]) params.set(key, geo[key]);
      }
      common(params);
      return `${ctx.target.photon}/structured?${params}`;
    },
    render: renderResults,
  }),
  photonTool({
    id: "reverse",
    group: "Geocoding",
    label: "Reverse",
    path: "/reverse",
    minPoints: 1,
    maxPoints: 1,
    hint: "One point. Click anywhere to read the address under it.",
    controls: () => "",
    advanced: () => geoAdvanced(number("radius", "radius, km", 'min="0" step="0.1"')),
    url(ctx) {
      const params = new URLSearchParams({
        lat: String(ctx.points[0].lat),
        lon: String(ctx.points[0].lon),
        limit: geo.limit || "5",
      });
      common(params);
      if (geo.radius) params.set("radius", geo.radius);
      return `${ctx.target.photon}/reverse?${params}`;
    },
    render(resp, ctx) {
      drawPins(ctx.map, resp.features);
      const first = resp.features[0]?.properties;
      panel.renderAnswer({
        ms: ctx.ms,
        raw: resp,
        curl: ctx.curl,
        nums: `<div class="num">${first ? panel.esc(label(first)) : "nothing here"}</div>`,
        badges: first ? [first.city, first.country].filter(Boolean) : [],
        detail: resultDetail(resp.features),
      });
    },
  }),
];
