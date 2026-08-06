// service_limits.isochrone caps contours at 4, a time contour at 120 minutes and a
// distance contour at 200 km. Only the last two produce an error message: a fifth
// contour comes back as an empty feature list, and a zero or negative value as a feature
// whose polygon has no coordinates. Both look exactly like a broken page, so the editor
// refuses them here rather than letting the map go quietly blank.
const MAX_ROWS = 4;
const LIMIT = { time: 120, distance: 200 };

let metric = "time";
let rows = [{ value: 15, color: null }, { value: 30, color: null }];
// The colours the last response carried, keyed by contour value. The engine spreads its
// palette across however many contours it was given, so it cannot be predicted here -
// the swatches simply show what came back until somebody picks their own.
let palette = {};

const rerun = () => window.dispatchEvent(new Event("explorer:rerun"));

export const currentMetric = () => metric;
const unit = () => (metric === "time" ? "min" : "km");

export function setMetric(next) {
  metric = next === "distance" ? "distance" : "time";
  for (const r of rows) r.value = Math.min(r.value, LIMIT[metric]);
  palette = {};
  render();
}

export function contourRows() {
  // A custom colour is sent WITHOUT its leading "#": the engine echoes back whatever it
  // is given, and "##rrggbb" is not a colour MapLibre will accept when the response is
  // drawn - it throws rather than falling back.
  return rows
    .filter((r) => r.value > 0 && r.value <= LIMIT[metric])
    .map((r) => (r.color
      ? { [metric]: r.value, color: r.color.replace(/^#/, "") }
      : { [metric]: r.value }));
}

// Called from the isochrone's render(): the parameter card is not rebuilt after a
// response, so nothing else would ever repaint these.
export function paintPalette(byValue) {
  palette = byValue;
  document.querySelectorAll("#contours [data-swatch]").forEach((sw) => {
    const row = rows[Number(sw.dataset.swatch)];
    if (row && !row.color && palette[row.value]) sw.style.background = palette[row.value];
  });
}

const rowHtml = (r, i) => `
  <div class="ct-row">
    <button class="ct-sw" data-swatch="${i}" title="colour"
      style="background:${r.color || palette[r.value] || "var(--line)"}"></button>
    <input type="number" class="ct-val" data-value="${i}" value="${r.value}"
      min="1" max="${LIMIT[metric]}" step="1">
    <span class="ct-unit">${unit()}</span>
    ${r.color ? `<button class="ct-auto" data-auto="${i}">auto</button>` : ""}
    <button class="ct-del" data-del="${i}"${rows.length > 1 ? "" : " disabled"}>&times;</button>
    <input type="color" class="ct-picker" data-picker="${i}" value="${r.color || palette[r.value] || "#bf4040"}">
  </div>`;

export const contoursControl = () => `
  <div class="field ct-head"><label>contours</label>
    <button class="mock-button" id="ct-add"${rows.length >= MAX_ROWS ? " disabled" : ""}>+ add</button>
  </div>
  <div id="contours">${rows.map(rowHtml).join("")}</div>`;

function render() {
  const holder = document.getElementById("contours");
  if (!holder) return;
  holder.innerHTML = rows.map(rowHtml).join("");
  const add = document.getElementById("ct-add");
  if (add) add.disabled = rows.length >= MAX_ROWS;
}

// The next row is one step past the largest, kept inside the engine's ceiling.
const nextValue = () => Math.min(Math.max(...rows.map((r) => r.value)) + 15, LIMIT[metric]);

document.addEventListener("click", (e) => {
  const sw = e.target.closest("[data-swatch]");
  if (sw) {
    // The native picker is the input itself, kept invisible: it is the only way to get
    // the platform colour dialogue, and a bare swatch is what the panel wants to show.
    document.querySelector(`[data-picker="${sw.dataset.swatch}"]`)?.click();
    return;
  }
  const auto = e.target.closest("[data-auto]");
  if (auto) {
    rows[Number(auto.dataset.auto)].color = null;
    render();
    rerun();
    return;
  }
  const del = e.target.closest("[data-del]");
  if (del && rows.length > 1) {
    rows.splice(Number(del.dataset.del), 1);
    render();
    rerun();
    return;
  }
  if (e.target.id === "ct-add" && rows.length < MAX_ROWS) {
    rows.push({ value: nextValue(), color: null });
    render();
    rerun();
  }
});

// Capture, for the same reason as the options module: the panel's change listener on
// #params fires the request, and on the bubble phase it would run first and send the
// previous value.
document.addEventListener("change", (e) => {
  const val = e.target.closest("[data-value]");
  if (val) {
    const i = Number(val.dataset.value);
    const clamped = Math.min(Math.max(Math.round(Number(val.value) || 0), 1), LIMIT[metric]);
    rows[i].value = clamped;
    val.value = clamped;                       // show the clamp rather than hide it
    return;                                    // the panel's own listener reruns
  }
  const pick = e.target.closest("[data-picker]");
  if (pick) {
    rows[Number(pick.dataset.picker)].color = pick.value;   // "#rrggbb" from the browser
    // After the event has finished, so the panel's listener still sees the live element
    // and fires exactly one request for this change.
    queueMicrotask(render);
  }
}, true);
