// One entry per published country image. What the selector actually shows is decided by
// availableCountries below: an image states its own slugs in a manifest, and only the
// website copy, which has none, falls back to filtering these by the tile server's
// bounds. Either way a single-country target hides the selector and the group image
// shows all of them. The centre and zoom are only where the map flies on a pick.
export const COUNTRIES = [
  { name: "Belgium", slug: "belgium", center: [4.47, 50.5], zoom: 7.5 },
  { name: "Brunei", slug: "brunei", center: [114.72, 4.53], zoom: 9 },
  { name: "Cyprus", slug: "cyprus", center: [33.2, 35.0], zoom: 8.5 },
  { name: "Georgia", slug: "georgia", center: [43.5, 42.0], zoom: 7 },
  { name: "Indonesia", slug: "indonesia", center: [117.0, -2.5], zoom: 4.2 },
  { name: "Kazakhstan", slug: "kazakhstan", center: [67.0, 48.0], zoom: 4.2 },
  { name: "Malaysia", slug: "malaysia", center: [109.5, 3.6], zoom: 5.2 },
  { name: "Serbia", slug: "serbia", center: [20.8, 44.0], zoom: 6.8 },
  { name: "Singapore", slug: "singapore", center: [103.82, 1.35], zoom: 10.5 },
  { name: "South Korea", slug: "south-korea", center: [127.8, 36.4], zoom: 6.5 },
  { name: "Vietnam", slug: "vietnam", center: [107.0, 16.0], zoom: 5 },
];

// bounds is the TileJSON array [west, south, east, north].
function countriesWithin(bounds) {
  if (!Array.isArray(bounds) || bounds.length !== 4) return COUNTRIES;
  const [west, south, east, north] = bounds;
  return COUNTRIES.filter(
    ({ center: [lon, lat] }) =>
      lon >= west && lon <= east && lat >= south && lat <= north,
  );
}

// Bounds alone cannot tell the three countries that share one Geofabrik extract apart:
// the brunei, malaysia and singapore images are built from the same PBF and report the
// same bounds, so a bounds-only filter offers all three on every one of them - while the
// geocoder inside each image carries only its own country's addresses. The image
// therefore states what it serves. Fetched rather than awaited in turn: it depends on
// nothing the page fetches, so it goes out with the style and the TileJSON instead of
// adding a round trip of its own to the bootstrap - a round trip the website copy, which
// has no manifest at all, would spend on a 404 before the page became usable.
export async function fetchManifest() {
  try {
    const resp = await fetch("./countries.json");
    if (resp.ok) return (await resp.json()).countries;
  } catch {
    // No manifest reachable: the caller falls back to the bounds filter.
  }
  return null;
}

// Without a manifest the bounds filter is the right answer: that is the website copy,
// which targets the hosted image that really does carry every country.
export function availableCountries(manifest, bounds) {
  if (manifest) {
    const wanted = new Set(manifest);
    const listed = COUNTRIES.filter((c) => wanted.has(c.slug));
    if (listed.length) return listed;
  }
  return countriesWithin(bounds);
}
