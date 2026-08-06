import { postJSON } from "../target.js";
import { decode } from "../polyline.js";
import * as panel from "../panel.js";
import { pointLabel } from "../points.js";
import {
  optionsControl, advancedBlock, advCheck, advNumber, advPick, withCosting, currentCosting,
} from "../options.js";
import { contoursControl, contourRows, currentMetric, setMetric, paintPalette } from "../contours.js";

// MapLibre 6 does not tolerate a malformed colour: addLayer throws, the layer is never
// added, and the exception escapes render() into the panel, which then shows a
// JavaScript message where the engine's answer should be. Anything that is not #rrggbb
// falls back to a neutral grey instead of taking the drawing down.
const HEX = /^#[0-9a-f]{6}$/i;
const safeColour = (c) => (HEX.test(c || "") ? c : "#8a8a8a");

// The isochrone's own arguments, held here rather than read from the DOM at request
// time, because the panel that carries them is rebuilt on every tool switch.
let isoReverse = false;
let isoPolygons = true;

document.addEventListener("change", (e) => {
  const f = e.target.closest("[data-iso]");
  if (!f) return;
  if (f.dataset.iso === "reverse") isoReverse = f.checked;
  if (f.dataset.iso === "polygons") isoPolygons = f.checked;
  if (f.dataset.iso === "metric") setMetric(f.value);
}, true);

// The curl block shows the canonical form from the README, not what the page sends.
// The page avoids a preflight by omitting the content type; curl has no CORS, and
// showing a browser workaround to somebody about to write a backend would mislead.
function curlPost(target, service, path, body) {
  return `curl ${target[service]}${path} \\\n  -d '${JSON.stringify(body)}'`;
}

// Every routing tool is one POST of the body its own builder returns, and the command
// shown beside the answer is that same body against that same path. Derived from the one
// `path` and the one `body` rather than written out per tool: spelled three times each,
// they could describe an endpoint the page never called.
const valhallaTool = ({ body, ...tool }) => ({
  method: "POST",
  controls: optionsControl,
  advanced: () => advancedBlock(),
  ...tool,
  execute: (ctx) => postJSON(ctx.target.valhalla, tool.path, body(ctx.points), ctx.signal),
  curl: (ctx) => curlPost(ctx.target, "valhalla", tool.path, body(ctx.points)),
});

function addLine(map, id, coords, color, width = 4) {
  map.addSource(id, {
    type: "geojson",
    data: { type: "Feature", geometry: { type: "LineString", coordinates: coords } },
  });
  map.addLayer({
    id,
    type: "line",
    source: id,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": color, "line-width": width },
  });
}

// The route's own arguments, held here rather than read from the DOM at request time,
// for the same reason as the isochrone's above: the panel that carries them is rebuilt on
// every tool switch, and a departure time typed into it would otherwise be lost on the
// way to another tool and back. Worse than lost, for the time: controls() is built from
// the OUTGOING panel, so re-picking the active Route tab kept the mode while the datetime
// input came back empty - the card said "depart at" over a request that carried no
// date_time at all.
let timeType = "none";
let departAt = "";
let altWanted = 0;

// What the last request asked for, so the answer can say how many alternates actually
// came back against how many were wanted. Distinct from altWanted, which is what the
// control currently holds: the engine caps the request at max_alternates and silently
// returns fewer - on a motorway pair it returns none at all.
let lastAlternates = 0;

// The engine's date_time types. "none" is not one of them: it is the absence of the
// field, which is the only way to get alternates - any date_time at all, including
// type 0, makes the engine return none of them.
const TIME_MODES = [
  { value: "none", label: "no time" },
  { value: "0", label: "now" },
  { value: "1", label: "depart at" },
  { value: "2", label: "arrive by" },
];
// Type 0 asks the engine for its own clock, so it carries no value of its own.
const needsValue = (mode) => mode === "1" || mode === "2";

// Records the state and, for the time mode, updates the two controls that depend on it -
// the parameter card is not rebuilt when a select inside it changes. This fires no rerun
// of its own: the panel's change listener already does that, and a second dispatch here
// would send a duplicate request, which on the hosted API costs one out of the rate limit
// for nothing. Capture, like every other listener in this page, so that the panel's
// listener sees the state this one leaves behind.
document.addEventListener("change", (e) => {
  const f = e.target.closest("[data-route]");
  if (!f) return;
  if (f.dataset.route === "departure") departAt = f.value;
  if (f.dataset.route === "alternates") altWanted = Math.max(0, Number(f.value) || 0);
  if (f.dataset.route !== "type") return;
  timeType = f.value;
  const when = document.getElementById("departure");
  if (when) when.disabled = !needsValue(timeType);
  const alternates = document.querySelector('[data-route="alternates"]');
  if (alternates) alternates.disabled = timeType !== "none";
  const note = document.getElementById("alt-note");
  if (note) note.hidden = timeType === "none";
}, true);

const routeBody = (points) => {
  const body = { locations: points };
  // Time-dependent routing is not a separate tool: it is this optional field, which
  // is where somebody looking for it would go. Read from the module state, the same way
  // the contour rows are, so the request and the curl command below it can never
  // describe different departure times.
  if (timeType === "0") body.date_time = { type: 0 };
  else if (needsValue(timeType) && departAt) {
    body.date_time = { type: Number(timeType), value: departAt };
  }

  lastAlternates = altWanted;
  // Asking for both is not an error the engine reports - it simply answers with no
  // alternates - so the request does not carry a field that cannot be honoured.
  if (lastAlternates > 0 && !body.date_time) body.alternates = lastAlternates;
  return withCosting(body);
};

export const routingTools = [
  valhallaTool({
    id: "route",
    group: "Routing",
    label: "Route",
    path: "/route",
    body: routeBody,
    minPoints: 2,
    // The engine's own service_limits cap auto routing at 20 locations; inviting more
    // would only earn an "Exceeded max locations" error.
    maxPoints: 20,
    hint: "Two to twenty points. Click the map to add one, drag a marker to move it.",
    controls() {
      const off = needsValue(timeType) ? "" : " disabled";
      return optionsControl() +
        `<div class="field"><label>time</label>
          <select id="dt-type" data-route="type">
            ${TIME_MODES.map((m) => `<option value="${m.value}"${
              m.value === timeType ? " selected" : ""}>${m.label}</option>`).join("")}
          </select>
          <input type="datetime-local" id="departure" data-route="departure"
            value="${panel.escAttr(departAt)}"${off}></div>`;
    },
    advanced: () => advancedBlock(
      advNumber("data-route", "alternates", "alternates", altWanted,
        `min="0" max="2" step="1"${timeType === "none" ? "" : " disabled"}`) +
      `<div class="hintline" id="alt-note"${timeType === "none" ? " hidden" : ""}>The engine
        returns no alternates for a time-dependent route.</div>`),
    render(resp, ctx) {
      const { summary, legs } = resp.trip;
      const mins = Math.round(summary.time / 60);
      const alternates = resp.alternates || [];
      // Alternates are drawn first, so the chosen route lands on top of them and stays
      // the one that reads as the answer.
      alternates.forEach((alt, i) => {
        addLine(ctx.map, `x-alt-${i}`,
          alt.trip.legs.flatMap((leg) => decode(leg.shape)), "#8aa9c9", 3);
      });
      const coords = legs.flatMap((leg) => decode(leg.shape));
      addLine(ctx.map, "x-route", coords, "#1f6feb");
      // Every leg's, not the first one's: the engine returns one leg per consecutive
      // pair, so a three-point route counted only the manoeuvres as far as B while the
      // line drawn above already ran to C.
      const steps = legs.flatMap((leg) => leg.maneuvers);
      panel.renderAnswer({
        ms: ctx.ms,
        raw: resp,
        curl: ctx.curl,
        nums: `<div class="num">${summary.length.toFixed(1)}<small>km</small></div>
               <div class="num">${Math.floor(mins / 60)} h ${mins % 60} min</div>
               <div class="num">${steps.length}<small>manoeuvres</small></div>`,
        // Only what the route actually does. The negative form of each of these reads
        // like a setting rather than a result, and the settings are already one card
        // above - a "no highways" badge under an unticked highways box says nothing new.
        badges: [
          ...(summary.has_highway ? ["uses highways"] : []),
          ...(summary.has_toll ? ["has tolls"] : []),
          ...(summary.has_ferry ? ["uses a ferry"] : []),
          ...(lastAlternates ? [`alternates: ${alternates.length} of ${lastAlternates}`] : []),
        ],
        detail: `${alternates.length
          ? `<div class="legend"><span class="sw snapped"></span>chosen
             <span class="sw alt"></span>alternate${alternates.length > 1 ? "s" : ""}</div>`
          : ""}<ul class="steps">${steps
          .slice(0, 3)
          .map((m, i) => `<li><i>${i + 1}</i>${panel.esc(m.instruction)}</li>`)
          .join("")}</ul>`,
      });
    },
  }),
  valhallaTool({
    id: "isochrone",
    group: "Routing",
    label: "Isochrone",
    path: "/isochrone",
    body: isochroneBody,
    minPoints: 1,
    maxPoints: 1,
    hint: "One point. Click the map to move it.",
    controls: () => optionsControl() + contoursControl(),
    advanced: () => advancedBlock(
      advCheck("data-iso", "reverse", "reverse - reach this point", isoReverse) +
      advPick("data-iso", "metric", ["time", "distance"], "metric", currentMetric()) +
      advCheck("data-iso", "polygons", "polygons", isoPolygons)),
    render(resp, ctx) {
      // The engine returns each contour's colour already prefixed with "#", largest
      // contour first. Drawing them in reverse puts the small ones on top.
      resp.features
        .slice()
        .reverse()
        .forEach((feature, i) => {
          const id = `x-iso-${i}`;
          const colour = safeColour(feature.properties.color);
          ctx.map.addSource(id, { type: "geojson", data: feature });
          // In line mode the geometry is a LineString. MapLibre accepts a fill layer
          // over one without complaint and draws nothing at all, so it is not added.
          if (isoPolygons) {
            ctx.map.addLayer({
              id,
              type: "fill",
              source: id,
              paint: { "fill-color": colour, "fill-opacity": 0.25 },
            });
          }
          ctx.map.addLayer({
            id: `${id}-line`,
            type: "line",
            source: id,
            paint: { "line-color": colour, "line-width": 2 },
          });
        });
      // Keyed by contour value, not by position: the engine always answers largest
      // first, whatever order the rows were typed in.
      paintPalette(Object.fromEntries(
        resp.features.map((f) => [f.properties.contour, safeColour(f.properties.color)])));
      panel.renderAnswer({
        ms: ctx.ms,
        raw: resp,
        curl: ctx.curl,
        nums: `<div class="num">${resp.features.length}<small>contours</small></div>`,
        badges: [
          `polygons: ${isoPolygons}`,
          `costing: ${currentCosting()}`,
          `metric: ${currentMetric()}`,
          ...(isoReverse ? ["reverse: true"] : []),
        ],
        detail: `<ul class="steps">${resp.features
          .map((f) => `<li><i>&#9670;</i>${f.properties.contour} ${
            f.properties.metric === "distance" ? "km" : "min"}</li>`)
          .join("")}</ul>`,
      });
    },
  }),
  valhallaTool({
    id: "matrix",
    group: "Routing",
    label: "Matrix",
    path: "/sources_to_targets",
    body: matrixBody,
    minPoints: 2,
    maxPoints: 5,
    hint: "Two to five points. Every pair is measured against every other.",
    render(resp, ctx) {
      const rows = resp.sources_to_targets;
      // Valhalla returns null time and distance for pairs it declines to compute,
      // which happens well under the documented matrix limit - render the gap
      // rather than printing "null".
      const cell = (c) => (c.time == null ? "-" : `${Math.round(c.time / 60)} min`);
      panel.renderAnswer({
        ms: ctx.ms,
        raw: resp,
        curl: ctx.curl,
        nums: `<div class="num">${rows.length * rows.length}<small>pairs</small></div>`,
        badges: [`costing: ${currentCosting()}`],
        detail: `<table class="matrix"><tr><th></th>${rows
          .map((_, j) => `<th>${pointLabel(j)}</th>`)
          .join("")}</tr>${rows
          .map((row, i) => `<tr><th>${pointLabel(i)}</th>${row.map((c) => `<td>${cell(c)}</td>`).join("")}</tr>`)
          .join("")}</table>`,
      });
    },
  }),
  valhallaTool({
    id: "optimized",
    group: "Routing",
    label: "Optimized",
    path: "/optimized_route",
    body: locationsBody,
    minPoints: 4,
    maxPoints: 8,
    hint: "Four points or more. The engine reorders the middle stops.",
    render(resp, ctx) {
      const coords = resp.trip.legs.flatMap((leg) => decode(leg.shape));
      addLine(ctx.map, "x-optimized", coords, "#1a7f37");
      const order = resp.trip.locations.map((l) => l.original_index);
      const mins = Math.round(resp.trip.summary.time / 60);
      panel.renderAnswer({
        ms: ctx.ms,
        raw: resp,
        curl: ctx.curl,
        nums: `<div class="num">${resp.trip.summary.length.toFixed(1)}<small>km</small></div>
               <div class="num">${mins}<small>min</small></div>`,
        badges: [`costing: ${currentCosting()}`],
        detail: `<div class="order">visiting order: ${order
          .map(pointLabel)
          .join(" &rarr; ")}</div>`,
      });
    },
  }),
  valhallaTool({
    id: "centroid",
    group: "Routing",
    label: "Meeting point",
    path: "/centroid",
    body: locationsBody,
    minPoints: 3,
    // service_limits.centroid.max_locations is 5, verified against a running image:
    // a sixth point returns error 150, "Exceeded max locations: 5".
    maxPoints: 5,
    hint: "Three to five points. The engine finds where they converge.",
    render(resp, ctx) {
      // The converging point is the last location in the response, not the first.
      // And the engine does not put every input in one trip: `trip` is the route from
      // the FIRST input, and every remaining input gets its own entry in `alternates`,
      // all converging on the same point. Verified against 3.8.3 with three inputs -
      // trip.locations was length 2 and alternates had 2 entries. Drawing only `trip`
      // would show one branch of three and claim a single input.
      const trips = [resp.trip, ...(resp.alternates || []).map((a) => a.trip)];
      const meeting = resp.trip.locations[resp.trip.locations.length - 1];
      trips.forEach((trip, i) => {
        const coords = trip.legs.flatMap((leg) => decode(leg.shape));
        addLine(ctx.map, `x-centroid-${i}`, coords, "#9a6700", 3);
      });
      ctx.map.addSource("x-meeting", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "Point", coordinates: [meeting.lon, meeting.lat] } },
      });
      ctx.map.addLayer({
        id: "x-meeting",
        type: "circle",
        source: "x-meeting",
        paint: { "circle-radius": 9, "circle-color": "#9a6700", "circle-stroke-width": 3, "circle-stroke-color": "#fff" },
      });
      panel.renderAnswer({
        ms: ctx.ms,
        raw: resp,
        curl: ctx.curl,
        nums: `<div class="num">${meeting.lat.toFixed(4)}, ${meeting.lon.toFixed(4)}</div>`,
        badges: [`costing: ${currentCosting()}`, `${trips.length} inputs`],
        detail: "",
      });
    },
  }),
  valhallaTool({
    id: "trace",
    group: "Routing",
    label: "Map matching",
    path: "/trace_route",
    body: traceBody,
    minPoints: 4,
    maxPoints: 20,
    // Map matching is not routing: the engine refuses a pair further apart than its
    // breakage distance, 2 km by default, with error 172. Say so, or the natural thing
    // to try - clicking a journey across the map - only produces an error.
    hint: "Four points or more, each within 2 km of the last. They are snapped to the road network.",
    render(resp, ctx) {
      // Draw the raw clicks against the snapped line, because the whole point of
      // map matching is the difference between the two.
      addLine(ctx.map, "x-raw", ctx.points.map((p) => [p.lon, p.lat]), "#bf4040", 2);
      const coords = resp.trip.legs.flatMap((leg) => decode(leg.shape));
      addLine(ctx.map, "x-snapped", coords, "#1f6feb");
      const mins = Math.round(resp.trip.summary.time / 60);
      panel.renderAnswer({
        ms: ctx.ms,
        raw: resp,
        curl: ctx.curl,
        nums: `<div class="num">${resp.trip.summary.length.toFixed(1)}<small>km</small></div>
               <div class="num">${mins}<small>min</small></div>`,
        badges: ["shape_match: map_snap", `${ctx.points.length} input points`],
        detail: `<div class="legend"><span class="sw raw"></span>your clicks
          <span class="sw snapped"></span>snapped to roads</div>`,
      });
    },
  }),
  valhallaTool({
    id: "locate",
    group: "Routing",
    label: "Locate",
    path: "/locate",
    body: locateBody,
    minPoints: 1,
    maxPoints: 1,
    hint: "One point. Shows the road it snaps to.",
    render(resp, ctx) {
      const edges = resp[0]?.edges || [];
      const names = edges[0]?.edge_info?.names || [];
      // "unnamed road" is only true when an edge was actually found. With no edges the
      // click landed away from the network, and claiming an unnamed road there would
      // be a different answer from the truth.
      const found = edges.length
        ? names.length
          ? names.slice(0, 3)
          : ["unnamed road"]
        : ["no edge near this point"];
      panel.renderAnswer({
        ms: ctx.ms,
        raw: resp,
        curl: ctx.curl,
        nums: `<div class="num">${edges.length}<small>edges</small></div>`,
        badges: found,
        detail: `<ul class="steps">${edges
          .slice(0, 3)
          .map((e) => `<li><i>&#9670;</i>way ${e.edge_info?.way_id ?? "-"}</li>`)
          .join("")}</ul>`,
      });
    },
  }),
  valhallaTool({
    id: "expansion",
    group: "Routing",
    label: "Expansion",
    path: "/expansion",
    body: expansionBody,
    minPoints: 1,
    maxPoints: 1,
    hint: "One point. Shows the edges the router actually explored.",
    render(resp, ctx) {
      ctx.map.addSource("x-expansion", { type: "geojson", data: resp });
      ctx.map.addLayer({
        id: "x-expansion",
        type: "line",
        source: "x-expansion",
        paint: { "line-color": "#1f6feb", "line-width": 1, "line-opacity": 0.55 },
      });
      panel.renderAnswer({
        ms: ctx.ms,
        raw: resp,
        curl: ctx.curl,
        nums: `<div class="num">${resp.features.length}<small>edges explored</small></div>`,
        badges: ["action: isochrone", "1 minute"],
        detail: "",
      });
    },
  }),
];

// The two tools that send nothing but the points and the profile.
function locationsBody(points) {
  return withCosting({ locations: points });
}

function traceBody(points) {
  return withCosting({ shape: points, shape_match: "map_snap" });
}

function locateBody(points) {
  return withCosting({ locations: points.slice(0, 1), verbose: true });
}

function expansionBody(points) {
  // /expansion wraps another action; without "action" the engine rejects the
  // request. One minute keeps the response small enough to draw.
  return withCosting({
    locations: points.slice(0, 1),
    action: "isochrone",
    contours: [{ time: 1 }],
    expansion_properties: ["edge_id", "cost", "distance", "edge_status"],
  });
}

function matrixBody(points) {
  return withCosting({ sources: points, targets: points });
}

function isochroneBody(points) {
  const body = {
    locations: points.slice(0, 1),
    contours: contourRows(),
    polygons: isoPolygons,
  };
  if (isoReverse) body.reverse = true;
  return withCosting(body);
}
