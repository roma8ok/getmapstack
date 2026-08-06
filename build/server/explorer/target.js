// Where the engines are is decided by where this page came from, never by the user.
// The rule keys on the hostname, not on the port: publishing the container as
// -p 9090:8080 is an ordinary thing to do, and a port-based rule sends that page to
// the public demo instead of the container beside it - silently, because everything
// still works, just against somebody else's data. An unrecognised host is therefore
// assumed to be an image serving its own engines, which is the safe direction to be
// wrong in. The scheme follows the page's own, so a deployment that terminates TLS in
// front of the engines keeps working.
const PUBLIC_SITE_HOSTS = new Set(["getmapstack.com", "www.getmapstack.com"]);

export function resolveTarget(loc = window.location) {
  if (PUBLIC_SITE_HOSTS.has(loc.hostname)) {
    const api = "https://api.getmapstack.com";
    return {
      valhalla: `${api}/valhalla`,
      photon: `${api}/photon`,
      martin: `${api}/martin`,
      hosted: true,
    };
  }
  const origin = `${loc.protocol}//${loc.hostname}`;
  return {
    valhalla: `${origin}:8002`,
    photon: `${origin}:2322`,
    martin: `${origin}:3000`,
    hosted: false,
  };
}

export class HttpError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

// No Content-Type header on purpose. Valhalla answers OPTIONS with 405, so any
// preflighted request fails outright; a plain string body makes fetch send
// text/plain;charset=UTF-8, which is CORS-safelisted and never preflighted. Valhalla
// parses the body as JSON regardless of the declared type.
export async function postJSON(base, path, body, signal) {
  const resp = await fetch(base + path, {
    method: "POST",
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
