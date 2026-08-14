// Where the engines are is decided by where this page came from, never by the user. An
// image serves the page and the engines from one origin under fixed prefixes, so the page
// needs no port knowledge at all: a container published on any host port works, and so
// does a deployment that terminates TLS in front.
export function resolveTarget(loc = window.location) {
  const origin = loc.origin;
  return {
    valhalla: `${origin}/valhalla`,
    photon: `${origin}/photon`,
    martin: `${origin}/martin`,
  };
}

export class HttpError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

// Served from its own image, this page is same-origin with the engines and nothing is
// preflighted, so the declared content type costs nothing. A cross-origin caller - anyone's
// own page pointed at a container - IS preflighted, because application/json is not
// CORS-safelisted. That is safe now only because the gateway answers OPTIONS itself; the
// routing engine behind it still refuses it with 405, which is why this request used to be
// sent without a content type at all.
export async function postJSON(base, path, body, signal) {
  const resp = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const text = await resp.text();
  if (!resp.ok) throw new HttpError(resp.status, text);
  return JSON.parse(text);
}

export async function getJSON(url, signal) {
  const resp = await fetch(url, { signal });
  const text = await resp.text();
  if (!resp.ok) throw new HttpError(resp.status, text);
  return JSON.parse(text);
}

// The same contract for the endpoints that answer with an image: a refusal is an
// HttpError carrying the engine's own message, so the panel reports it the way it
// reports every other failure.
export async function getBlob(url, signal) {
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new HttpError(resp.status, await resp.text());
  return resp.blob();
}
