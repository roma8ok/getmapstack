import * as maplibregl from "/vendor/maplibre-gl.js";
import { resolveTarget, getJSON } from "./target.js";
import { loadStyle } from "./style.js";
import { availableCountries, fetchManifest } from "./countries.js";
import { TOOLS } from "./tools.js";
import { createPoints } from "./points.js";
import * as panel from "./panel.js";

const target = resolveTarget();

// map, countrySelect and points only exist once main() has fetched the style and
// built the map.
let map, countrySelect, points;
let active = TOOLS[0];
let inflight = null;

// Built once. Which entry is current is a class on an existing node, not a reason to
// rebuild the strip and rebind every listener - the clicks are delegated below.
function renderStrip() {
  const groups = ["Routing", "Geocoding", "Map"];
  document.getElementById("tools").innerHTML = groups
    .map((g) =>
      `<span class="group-label">${g}</span>` +
      TOOLS.filter((t) => t.group === g)
        .map((t) => `<div class="tool" data-id="${t.id}">${t.label}</div>`)
        .join(""))
    .join("");
}

const markActive = () =>
  document.querySelectorAll(".tool")
    .forEach((elem) => elem.classList.toggle("on", elem.dataset.id === active.id));

function select(tool) {
  // A registry can legitimately be empty while the tools are still being added, and a
  // filtered one can come back empty too. Neither may take the page down.
  if (!tool) return;
  active = tool;
  points.useTool(tool.id, tool.maxPoints);
  markActive();
  panel.renderParams(
    tool,
    tool.controls ? tool.controls() : "",
    tool.advanced ? tool.advanced() : "");
  clearLayers();
  // run() renders the point list before it does anything else, so it is not rendered
  // here as well.
  run();
}

// One request per tool at a time: a new one aborts the previous, so dragging a
// marker across the map cannot queue a dozen isochrones.
async function run() {
  // The click handler is wired independently of the registry, so this can fire before
  // any tool is active - an empty or fully filtered registry must not throw here.
  if (!active) return;
  panel.renderPoints(points.list());
  // Abort before the early return, not after: dropping below minPoints (a tool switch,
  // a cleared set) must also cancel whatever is still in flight, or a stale answer
  // renders into a panel that has moved on.
  if (inflight) inflight.abort();
  if (points.list().length < active.minPoints) {
    // Never leave the previous tool's answer on screen looking like this one's: an
    // early return has to say what it is waiting for, and the map has to stop showing
    // a drawing for points that are no longer there.
    clearLayers();
    panel.renderWaiting(active, points.list().length);
    return;
  }
  inflight = new AbortController();
  const ctx = { map, target, points: points.list(), signal: inflight.signal };
  const started = performance.now();
  // Build the command from the same DOM state the request is built from, in the same
  // synchronous block. Computed after the await it could read a field the user edited
  // while the answer was in flight, and show a command that was never sent.
  const curl = active.curl(ctx);
  try {
    const response = await active.execute(ctx);
    const ms = Math.round(performance.now() - started);
    // Clear here rather than before the request, so the previous answer stays on the
    // map while the new one is in flight. It must happen on EVERY render, not only on
    // a tool switch: re-rendering the same tool - a costing switch, a dragged marker,
    // one more clicked point - would otherwise add a source id that already exists,
    // and MapLibre throws on that.
    clearLayers();
    active.render(response, { ...ctx, ms, curl });
  } catch (err) {
    if (err.name === "AbortError") return;
    // The same rule as the early return above, for the same reason: whatever is still
    // drawn answered a different request from the one that just failed - a route to
    // where a marker used to be, a set of pins for a query since edited - while the
    // error card and the command beside it describe the new one. A tool whose own
    // render() threw partway also leaves half a drawing behind, and that goes here too.
    clearLayers();
    panel.renderError(err, curl, target.hosted);
  }
}

// Every tool draws into sources and layers whose ids start with "x-", so clearing is
// one rule rather than a list each tool has to maintain. getLayersOrder returns the ids
// alone; getStyle() serialises the whole style - all ~119 basemap layers and every
// source - and this runs on every marker drag, so it is asked for only the once it
// takes to reach the sources.
function clearLayers() {
  for (const id of map.getLayersOrder()) {
    if (id.startsWith("x-")) map.removeLayer(id);
  }
  for (const id of Object.keys(map.getStyle().sources)) {
    if (id.startsWith("x-")) map.removeSource(id);
  }
}

async function main() {
  const [style, tilejson, manifest] = await Promise.all([
    loadStyle(target.martin),
    getJSON(`${target.martin}/basemap`),
    fetchManifest(),
  ]);

  map = new maplibregl.Map({
    container: "map",
    style,
    bounds: tilejson.bounds,
    fitBoundsOptions: { padding: 24 },
    attributionControl: { compact: false },
  });
  map.addControl(new maplibregl.NavigationControl(), "top-right");
  map.addControl(new maplibregl.ScaleControl());

  // The selector doubles as the image chooser in the "run it yourself" card, so it is
  // only useful when the target really carries several countries. Named countrySelect,
  // not select: the tool framework defines a select() function.
  countrySelect = document.getElementById("country");
  const available = availableCountries(manifest, tilejson.bounds);
  if (available.length > 1) {
    countrySelect.hidden = false;
    countrySelect.innerHTML = available
      .map((c) => `<option value="${c.slug}">${c.name}</option>`)
      .join("");
    countrySelect.addEventListener("change", () => {
      const c = available.find((x) => x.slug === countrySelect.value);
      map.flyTo({ center: c.center, zoom: c.zoom });
      panel.renderRunCard(c.slug, target.hosted);
    });
  }

  // Versions and the age of the map data, straight from the engines. A failure here
  // leaves the badge blank rather than raising an unhandled rejection: the header is
  // decoration, and the page must stay usable without it. An unreachable engine shows
  // up where it matters anyway - the first tool that needs it answers with an error.
  getJSON(`${target.valhalla}/status`).then((s) => {
    document.getElementById("m-valhalla").textContent = `valhalla ${s.version}`;
    if (s.tileset_last_modified) {
      const day = new Date(s.tileset_last_modified * 1000).toISOString().slice(0, 10);
      document.getElementById("m-data").textContent = `osm data ${day}`;
    }
  }).catch(() => {});
  getJSON(`${target.photon}/status`).then((s) => {
    document.getElementById("m-photon").textContent = `photon ${s.version}`;
  }).catch(() => {});

  points = createPoints(map, maplibregl, () => run());

  // MapLibre's load event is one-shot: a listener added after it has fired is never
  // called, and that failure is total and silent - the map draws, the tool strip stays
  // empty, and nothing throws. The loaded() branch is what keeps that true however much
  // work ends up between the map's construction and this line.
  const onLoad = () => {
    renderStrip();
    select(TOOLS[0]);
    // Deliberately after select(): this handler is outside main()'s catch, so anything
    // that throws above it silently swallows the run card too. The image to name is the
    // one the page is actually talking to - the selector's when there is a choice, and
    // the single available country's when there is not. Naming no image at all beats
    // naming the wrong one.
    const slug = countrySelect.value || available[0]?.slug;
    if (slug) panel.renderRunCard(slug, target.hosted);
  };
  if (map.loaded()) onLoad();
  else map.on("load", onLoad);
}

window.addEventListener("explorer:rerun", () => run());

// The strip is built once, so its clicks are delegated to the container rather than
// bound per entry and rebound on every switch.
document.getElementById("tools").addEventListener("click", (e) => {
  const entry = e.target.closest(".tool");
  if (entry) select(TOOLS.find((t) => t.id === entry.dataset.id));
});

// Delegated because renderParams replaces the button on every tool switch. clear()
// fires onChange, so the panel drops straight into its waiting state.
document.getElementById("params").addEventListener("click", (e) => {
  if (e.target.id === "clear-points") points.clear();
  // A tool whose answer depends on the map view rather than on its points has no other
  // way to ask for a new one. Marked by an attribute, so the shell stays out of the
  // business of knowing which tool that is.
  if (e.target.closest("[data-rerun]")) run();
  // Keyed on a data attribute rather than an id, because there is one of these per
  // point and an id would not be unique.
  const remove = e.target.closest("[data-remove]");
  if (remove) points.removeAt(Number(remove.dataset.remove));
});

// Delegated for the same reason: renderParams replaces every input on each tool
// switch, so a listener bound to one field would not survive it. Covers the
// geocoding tools' text fields (search query, structured city/street/postcode),
// which have no point set to trigger a rerun on their own.
document.getElementById("params").addEventListener("change", () => run());

// A page that cannot reach its engines must say which address it tried. Without this
// the failure is a blank shell and a console nobody opens, which is the same silent
// wrongness the target and style rules exist to prevent.
main().catch((err) => {
  document.getElementById("params").innerHTML = `
    <div class="card-body">
      <div class="err"><span class="code">!</span>
        <span class="msg">Cannot reach the engines behind this page.</span></div>
      <div class="errnote">Tried <code>${target.martin}</code>. This page expects the
        routing, geocoding and map services on ports 8002, 2322 and 3000 of
        <code>${window.location.hostname}</code>. If the container publishes them
        elsewhere, it cannot find them.</div>
    </div>`;
  console.error("explorer: bootstrap failed", err);
});
