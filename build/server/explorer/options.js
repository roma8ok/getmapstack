import { esc, escAttr } from "./panel.js";

// The routing profile and its costing options live here rather than in the tool list:
// the engine takes them as one field on every routing endpoint, and the panel shows one
// control for all of them. Five of the eight routing tools visibly change with them -
// route, matrix, optimised route, meeting point and isochrone. Locate, map matching and
// expansion accept them and return the same answer, which is a property of those
// methods, not a bug here.

let costing = "auto";
// The parameter card is rebuilt on every tool switch, so a <details> that did not
// remember its own state would shut again each time the tool changed.
let advOpen = false;
// Field values, keyed by the costing_options key. Shared across profiles on purpose:
// "use_tolls" means the same thing to auto and to truck.
const values = {};

const PROFILES = ["auto", "bicycle", "pedestrian", "truck"];

// Only options that demonstrably change a route on the data these images carry. Anything
// elevation-driven is excluded: the images are built without elevation data, so those
// options are permanently inert and a control that can never do anything is worse than
// no control.
const ROAD = [
  { key: "use_tolls", label: "tolls", kind: "check", def: 1 },
  { key: "use_highways", label: "highways", kind: "check", def: 1 },
  { key: "use_ferry", label: "ferries", kind: "check", def: 1 },
];

const FIELDS = {
  auto: ROAD,
  truck: [
    ...ROAD,
    { key: "hazmat", label: "hazmat", kind: "check", def: 0 },
    { key: "height", label: "height, m", kind: "num", step: "0.1" },
    { key: "width", label: "width, m", kind: "num", step: "0.1" },
    { key: "length", label: "length, m", kind: "num", step: "0.1" },
    { key: "weight", label: "weight, t", kind: "num", step: "0.1" },
  ],
  bicycle: [
    { key: "bicycle_type", label: "type", kind: "pick",
      options: ["", "Road", "Hybrid", "City", "Cross", "Mountain"] },
    { key: "use_roads", label: "use roads, 0-1", kind: "num", step: "0.1" },
    { key: "cycling_speed", label: "speed, km/h", kind: "num", step: "1" },
  ],
  pedestrian: [
    { key: "walking_speed", label: "speed, km/h", kind: "num", step: "0.1" },
  ],
};

export const currentCosting = () => costing;

// The three rows an advanced block is built from. Every module that adds one owns its
// own state and therefore its own data attribute - data-opt here, data-geo for the
// geocoding fields, data-iso and data-route for the two routing tools that carry extra
// arguments - so the attribute is a parameter and the markup is written once. A second
// copy would let one block's rows drift out of alignment with the rest of the card.
export const advCheck = (attr, key, label, on) =>
  `<label class="adv-row"><input type="checkbox" ${attr}="${key}"${
    on ? " checked" : ""}><span>${esc(label)}</span></label>`;

export const advPick = (attr, key, options, label, value) =>
  `<label class="adv-row"><span>${esc(label)}</span><select ${attr}="${key}">${options
    .map((o) => `<option value="${o}"${o === value ? " selected" : ""}>${o || "default"}</option>`)
    .join("")}</select></label>`;

// value is escaped like any other attribute even though a number input constrains what
// can be typed into it: the helper takes whatever a caller passes, and the next caller is
// the one that hands it a free-text field.
export const advNumber = (attr, key, label, value, extra = "") =>
  `<label class="adv-row"><span>${esc(label)}</span>
    <input type="number" ${attr}="${key}" value="${escAttr(value)}" ${extra}></label>`;

const fieldHtml = (f) => {
  const v = values[f.key];
  if (f.kind === "check") {
    return advCheck("data-opt", f.key, f.label, (v === undefined ? f.def : v) === 1);
  }
  if (f.kind === "pick") return advPick("data-opt", f.key, f.options, f.label, v ?? "");
  return advNumber("data-opt", f.key, f.label, v ?? "", `step="${f.step}" min="0"`);
};

const profileFields = () => FIELDS[costing].map(fieldHtml).join("");

export const optionsControl = () => `
  <div class="seg" id="costing">
    ${PROFILES.map((c) => `<button data-costing="${c}"${c === costing ? ' class="on"' : ""}>${c}</button>`)
      .join("")}
  </div>`;

// withProfile is false for the geocoding tools: they take no costing at all, and a
// routing profile inside their advanced block would be a control that does nothing.
export const advancedBlock = (extra = "", withProfile = true) => `
  <details class="adv" id="adv"${advOpen ? " open" : ""}>
    <summary>advanced</summary>
    <div class="adv-body">
      ${withProfile ? `<div id="adv-profile">${profileFields()}</div>` : ""}
      ${extra}
    </div>
  </details>`;

// A field left alone is not sent at all: the engine's own default must not be replaced
// by a guess of ours, and the engine ignores unknown or malformed keys silently, so a
// wrong value would never be reported.
export function costingOptions() {
  const out = {};
  for (const f of FIELDS[costing]) {
    const v = values[f.key];
    if (v === undefined || v === "") continue;
    if (f.kind === "check") {
      if (v !== f.def) out[f.key] = v;
      continue;
    }
    if (f.kind === "num") {
      const n = Number(v);
      if (Number.isFinite(n)) out[f.key] = n;
      continue;
    }
    out[f.key] = v;
  }
  return Object.keys(out).length ? { [costing]: out } : null;
}

// Every routing tool builds its body through this, so the request and the curl line
// below it can never disagree about the profile or its options.
export function withCosting(body) {
  const opts = costingOptions();
  return opts ? { ...body, costing, costing_options: opts } : { ...body, costing };
}

document.addEventListener("click", (e) => {
  const button = e.target.closest("#costing button");
  if (!button) return;
  costing = button.dataset.costing;
  document.querySelectorAll("#costing button").forEach((b) => b.classList.remove("on"));
  button.classList.add("on");
  // The parameter card is only rebuilt on a tool switch, so the profile-dependent fields
  // must be replaced here - otherwise a truck would keep showing a bicycle's options.
  const holder = document.getElementById("adv-profile");
  if (holder) holder.innerHTML = profileFields();
  window.dispatchEvent(new Event("explorer:rerun"));
});

// Capture phase on purpose. The panel's own change listener sits on #params and fires
// the request; on the bubble phase it would run BEFORE this one and send the previous
// value. Capture runs first, so the request always carries what the user just typed.
document.addEventListener("change", (e) => {
  const f = e.target.closest("[data-opt]");
  if (!f) return;
  values[f.dataset.opt] = f.type === "checkbox" ? (f.checked ? 1 : 0) : f.value;
}, true);

// toggle does not bubble, so this listener has to capture too.
document.addEventListener("toggle", (e) => {
  if (e.target.id === "adv") advOpen = e.target.open;
}, true);
