import { pointLabel } from "./points.js";

const el = (id) => document.getElementById(id);
// Escapes text for a TEXT-NODE context. It is NOT sufficient for an attribute context -
// quotes are not escaped - so anything landing inside an attribute goes through escAttr
// instead.
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
// Attribute context. Every field the user types is re-interpolated into its own value=""
// on each rebuild of the parameter card, so a bare quote in one would close the attribute
// early and turn the rest of the card into markup. The rule is the whole class: an
// attribute is written with this, never with esc and never raw.
export const escAttr = (s) => esc(s).replace(/"/g, "&quot;");

// advanced is rendered last on purpose, below the points and the hint: it is the
// bottom of the card, and threading it through the controls string would put a
// collapsible block between the tool's own parameters and the points they apply to.
export function renderParams(tool, controls, advanced = "") {
  el("params").innerHTML = `
    <div class="card-head"><b>${esc(tool.label)}</b><span>${esc(tool.method)} ${esc(tool.path)}</span></div>
    <div class="card-body">${controls}
      <div id="points-list"></div>
      <div class="hintline">${esc(tool.hint)}</div>
      ${tool.maxPoints > 0 ? '<button class="mock-button" id="clear-points">clear points</button>' : ""}
      ${advanced}
    </div>`;
}

export function renderPoints(points) {
  // The click handler that calls this is wired as soon as createPoints() runs, two
  // lines before the map's load handler first calls renderParams() and creates this
  // element. A click in that window must be a silent no-op, not a console error.
  const target = el("points-list");
  if (!target) return;
  target.innerHTML = points
    .map((p, i) => `<div class="pt"><i class="pin">${pointLabel(i)}</i>
      <span class="co mono">${p.lat}, ${p.lon}</span>
      <button class="pt-del" data-remove="${i}" title="remove this point">&times;</button></div>`)
    .join("");
}

// The command that produced what is on screen, under every answer and under every error
// alike - a failure is exactly when somebody wants to rerun the request by hand. One
// block and one wiring, so the two cards cannot end up with different copy behaviour.
const curlBlock = (curl) => `
    <div class="curlhead">curl <button id="copy">copy</button></div>
    <div class="curl mono">${esc(curl)}</div>`;

// navigator.clipboard exists only in a secure context. This page is served over plain
// HTTP, so the API is there when the container is opened at localhost and gone the
// moment the same container is opened by LAN address or IP - which the target rule
// deliberately supports. Reached that way, an unguarded writeText throws inside the
// click handler and the button does nothing at all, with the reason only in a console
// nobody has open.
function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => selectionCopy(text));
    return;
  }
  selectionCopy(text);
}

// execCommand is deprecated and still the only thing that copies outside a secure
// context. Off-screen rather than hidden: a display:none textarea has no selection to
// copy from.
function selectionCopy(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand("copy");
  } catch {
    // Nothing left to fall back to. The text is on screen and selectable by hand.
  } finally {
    area.remove();
  }
}

const wireCopy = (curl) => el("copy").addEventListener("click", () => copyText(curl));

// How much of a response is put into the page. The engine's own answers reach megabytes -
// an expansion over ten minutes is tens of thousands of edges - and pasting one of those
// into the DOM freezes the tab. Only the display is cut; copying always takes all of it.
const RAW_SHOWN = 20000;

// Order is deliberate: the always-visible curl block sits above the
// variable-length detail list, so a long list never pushes it off screen.
// Tools pass `raw` (the decoded response) and get the size computed here; the two that
// answer with an image have no JSON to show and pass a plain `size` instead.
export function renderAnswer({ nums, badges = [], curl, detail = "", ms, size, raw }) {
  const json = raw === undefined ? null : JSON.stringify(raw, null, 2);
  const label = size ?? `${Math.round(json.length / 1024)} KB`;
  const shown = json !== null && json.length > RAW_SHOWN
    ? `${json.slice(0, RAW_SHOWN)}\n\n... truncated for display - copy takes all of it`
    : json;
  el("answer").innerHTML = `
    <div class="card-head"><b>Response</b><span>${esc(ms)} ms</span></div>
    <div class="card-body">
      <div class="nums">${nums}</div>
      <div class="badges">${badges.map((b) => `<span class="badge">${esc(b)}</span>`).join("")}</div>
    </div>
    ${curlBlock(curl)}
    <div class="card-body">${detail}</div>
    ${json === null
      ? `<div class="disc">response <span style="margin-left:auto">${esc(label)}</span></div>`
      : `<details class="rawbox">
           <summary class="disc">raw JSON
             <span class="rawsize">${esc(label)}</span>
             <button id="copy-raw">copy</button></summary>
           <pre class="curl mono rawbody">${esc(shown)}</pre>
         </details>`}`;
  wireCopy(curl);
  el("copy-raw")?.addEventListener("click", (e) => {
    // The button lives inside the <summary>, so without this a copy would also toggle
    // the block open - or shut, on the second press.
    e.preventDefault();
    copyText(json);
  });
}

// Shown whenever a tool cannot run yet. Without it the answer card keeps whatever the
// previous tool produced, which reads as a current answer to a question nobody asked.
export function renderWaiting(tool, have) {
  const need = tool.minPoints;
  el("answer").innerHTML = `
    <div class="card-head"><b>Response</b><span>waiting</span></div>
    <div class="card-body"><div class="hintline">${esc(tool.label)} needs
      ${need} point${need === 1 ? "" : "s"}, you have ${have}. Click the map to add
      one.</div></div>`;
}

// A failure is reported with the request that produced it, whatever the status: the panel
// never hides an error behind a friendlier message.
export function renderError(err, curl) {
  // Not every failure is an HttpError. A bug in a tool's own rendering arrives here as
  // a plain Error with no status and no body, and reading .body off it would throw
  // inside the very function meant to report the problem - leaving the panel frozen on
  // the previous answer while the page looks like it worked.
  const status = err.status ?? "error";
  const detail = err.body ?? err.message ?? String(err);
  el("answer").innerHTML = `
    <div class="card-head"><b>Response</b><span>${esc(status)}</span></div>
    <div class="card-body">
      <div class="err"><span class="code">${esc(status)}</span>
        <span class="msg">${esc(detail.slice(0, 200))}</span></div>
    </div>
    ${curlBlock(curl)}`;
  wireCopy(curl);
}
