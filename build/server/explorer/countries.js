// One entry per published country image. What the selector actually shows is decided by
// availableCountries below: an image states its own slugs in a manifest, and a page with
// no manifest to read falls back to filtering these by the tile server's bounds. Either
// way one available country hides the selector and several show it. The centre and zoom
// are only where the map flies on a pick.
export const COUNTRIES = [
  { name: "Afghanistan", slug: "afghanistan", center: [66.4, 33.9], zoom: 5.4 },
  { name: "Armenia", slug: "armenia", center: [45.0, 40.2], zoom: 7.2 },
  { name: "Azerbaijan", slug: "azerbaijan", center: [47.8, 40.3], zoom: 6.6 },
  { name: "Belgium", slug: "belgium", center: [4.47, 50.5], zoom: 7.5 },
  { name: "Brunei", slug: "brunei", center: [114.72, 4.53], zoom: 9 },
  { name: "Cambodia", slug: "cambodia", center: [104.9, 12.6], zoom: 6.6 },
  { name: "Cyprus", slug: "cyprus", center: [33.2, 35.0], zoom: 8.5 },
  { name: "Georgia", slug: "georgia", center: [43.5, 42.0], zoom: 7 },
  { name: "Indonesia", slug: "indonesia", center: [117.0, -2.5], zoom: 4.2 },
  { name: "Kazakhstan", slug: "kazakhstan", center: [67.0, 48.0], zoom: 4.2 },
  { name: "Kyrgyzstan", slug: "kyrgyzstan", center: [74.6, 41.2], zoom: 6.2 },
  { name: "Laos", slug: "laos", center: [103.8, 18.3], zoom: 5.6 },
  { name: "Malaysia", slug: "malaysia", center: [109.5, 3.6], zoom: 5.2 },
  { name: "Mongolia", slug: "mongolia", center: [103.5, 46.8], zoom: 4.4 },
  { name: "Myanmar", slug: "myanmar", center: [96.5, 19.8], zoom: 4.8 },
  { name: "Philippines", slug: "philippines", center: [122.0, 12.0], zoom: 5 },
  { name: "Serbia", slug: "serbia", center: [20.8, 44.0], zoom: 6.8 },
  { name: "Singapore", slug: "singapore", center: [103.82, 1.35], zoom: 10.5 },
  { name: "South Africa", slug: "south-africa", center: [25.0, -29.0], zoom: 5.2 },
  { name: "South Korea", slug: "south-korea", center: [127.8, 36.4], zoom: 6.5 },
  { name: "Tajikistan", slug: "tajikistan", center: [71.0, 38.8], zoom: 6.4 },
  { name: "Thailand", slug: "thailand", center: [101.0, 13.2], zoom: 5 },
  { name: "Turkmenistan", slug: "turkmenistan", center: [59.0, 39.0], zoom: 5.4 },
  { name: "Uzbekistan", slug: "uzbekistan", center: [64.6, 41.4], zoom: 5.2 },
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
// adding a round trip of its own to the bootstrap - a round trip that, where no manifest
// is served at all, would be spent on a 404 before the page became usable.
export async function fetchManifest() {
  try {
    const resp = await fetch("./countries.json");
    if (resp.ok) return (await resp.json()).countries;
  } catch {
    // No manifest reachable: the caller falls back to the bounds filter.
  }
  return null;
}

// Without a manifest the bounds filter is the right answer: an older image that shipped
// no manifest still gets a usable selector rather than an empty one.
export function availableCountries(manifest, bounds) {
  if (manifest) {
    const wanted = new Set(manifest);
    const listed = COUNTRIES.filter((c) => wanted.has(c.slug));
    if (listed.length) return listed;
  }
  return countriesWithin(bounds);
}
