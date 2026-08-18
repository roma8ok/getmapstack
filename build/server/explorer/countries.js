// One entry per published country image. What the selector actually shows is decided by
// availableCountries below: an image states its own slugs in a manifest, and a page with
// no manifest to read falls back to filtering these by the tile server's bounds. Either
// way one available country hides the selector and several show it. The centre and zoom
// are only where the map flies on a pick.
export const COUNTRIES = [
  { name: "Afghanistan", slug: "afghanistan", center: [66.4, 33.9], zoom: 5.4 },
  { name: "Algeria", slug: "algeria", center: [1.66, 28.13], zoom: 4.9 },
  { name: "Angola", slug: "angola", center: [17.77, -11.19], zoom: 5.3 },
  { name: "Armenia", slug: "armenia", center: [45.0, 40.2], zoom: 7.2 },
  { name: "Azerbaijan", slug: "azerbaijan", center: [47.8, 40.3], zoom: 6.6 },
  { name: "Bahrain", slug: "bahrain", center: [50.55, 26.05], zoom: 9.5 },
  { name: "Bangladesh", slug: "bangladesh", center: [90.3, 23.7], zoom: 6.6 },
  { name: "Belgium", slug: "belgium", center: [4.47, 50.5], zoom: 7.5 },
  { name: "Benin", slug: "benin", center: [2.31, 9.22], zoom: 6.4 },
  { name: "Bhutan", slug: "bhutan", center: [90.4, 27.4], zoom: 7.6 },
  { name: "Botswana", slug: "botswana", center: [24.69, -22.34], zoom: 5.9 },
  { name: "Brunei", slug: "brunei", center: [114.72, 4.53], zoom: 9 },
  { name: "Burkina Faso", slug: "burkina-faso", center: [-1.56, 12.24], zoom: 6.6 },
  { name: "Burundi", slug: "burundi", center: [29.93, -3.39], zoom: 8 },
  { name: "Cabo Verde", slug: "cabo-verde", center: [-24.01, 16.01], zoom: 7.6 },
  { name: "Cambodia", slug: "cambodia", center: [104.9, 12.6], zoom: 6.6 },
  { name: "Cameroon", slug: "cameroon", center: [12.29, 7.37], zoom: 5.6 },
  { name: "Central African Republic", slug: "central-african-republic", center: [20.94, 6.61], zoom: 6 },
  { name: "Chad", slug: "chad", center: [18.74, 15.45], zoom: 5.1 },
  { name: "Comoros", slug: "comoros", center: [43.9, -12.07], zoom: 8.2 },
  { name: "Côte d'Ivoire", slug: "ivory-coast", center: [-5.55, 7.45], zoom: 6.4 },
  { name: "Cyprus", slug: "cyprus", center: [33.2, 35.0], zoom: 8.5 },
  { name: "Djibouti", slug: "djibouti", center: [42.71, 11.85], zoom: 8.2 },
  { name: "DR Congo", slug: "dr-congo", center: [21.67, -4.03], zoom: 4.9 },
  { name: "Egypt", slug: "egypt", center: [30.88, 26.91], zoom: 5.8 },
  { name: "Equatorial Guinea", slug: "equatorial-guinea", center: [8.41, 1.16], zoom: 6.6 },
  { name: "Eritrea", slug: "eritrea", center: [39.87, 15.21], zoom: 6.6 },
  { name: "Eswatini", slug: "eswatini", center: [31.46, -26.52], zoom: 8.4 },
  { name: "Ethiopia", slug: "ethiopia", center: [40.49, 9.15], zoom: 5.6 },
  { name: "Gabon", slug: "gabon", center: [11.51, -0.9], zoom: 6.4 },
  { name: "Gambia", slug: "gambia", center: [-15.41, 13.44], zoom: 8 },
  { name: "Georgia", slug: "georgia", center: [43.5, 42.0], zoom: 7 },
  { name: "Ghana", slug: "ghana", center: [-0.99, 7.86], zoom: 6.4 },
  { name: "Guinea", slug: "guinea", center: [-11.6, 9.93], zoom: 6.7 },
  { name: "Guinea-Bissau", slug: "guinea-bissau", center: [-15.27, 11.67], zoom: 8 },
  { name: "India", slug: "india", center: [79.0, 22.5], zoom: 4.2 },
  { name: "Indonesia", slug: "indonesia", center: [117.0, -2.5], zoom: 4.2 },
  { name: "Iraq", slug: "iraq", center: [43.7, 33.2], zoom: 6.0 },
  { name: "Israel", slug: "israel", center: [34.95, 31.5], zoom: 7.4 },
  { name: "Jordan", slug: "jordan", center: [36.2, 31.3], zoom: 7.0 },
  { name: "Kazakhstan", slug: "kazakhstan", center: [67.0, 48.0], zoom: 4.2 },
  { name: "Kenya", slug: "kenya", center: [37.91, -0.14], zoom: 5.9 },
  { name: "Kuwait", slug: "kuwait", center: [47.8, 29.3], zoom: 8.2 },
  { name: "Kyrgyzstan", slug: "kyrgyzstan", center: [74.6, 41.2], zoom: 6.2 },
  { name: "Laos", slug: "laos", center: [103.8, 18.3], zoom: 5.6 },
  { name: "Lebanon", slug: "lebanon", center: [35.85, 33.9], zoom: 8.2 },
  { name: "Lesotho", slug: "lesotho", center: [28.23, -29.62], zoom: 8 },
  { name: "Liberia", slug: "liberia", center: [-9.49, 6.35], zoom: 7 },
  { name: "Libya", slug: "libya", center: [17.38, 26.43], zoom: 5.3 },
  { name: "Madagascar", slug: "madagascar", center: [46.82, -18.76], zoom: 5.3 },
  { name: "Malawi", slug: "malawi", center: [34.3, -13.25], zoom: 6.2 },
  { name: "Malaysia", slug: "malaysia", center: [109.5, 3.6], zoom: 5.2 },
  { name: "Maldives", slug: "maldives", center: [73.4, 3.5], zoom: 6.4 },
  { name: "Mali", slug: "mali", center: [-3.99, 17.57], zoom: 5.2 },
  { name: "Mauritania", slug: "mauritania", center: [-11.04, 21.02], zoom: 5.5 },
  { name: "Mauritius", slug: "mauritius", center: [60.05, -15.43], zoom: 5.7 },
  { name: "Mongolia", slug: "mongolia", center: [103.5, 46.8], zoom: 4.4 },
  { name: "Morocco", slug: "morocco", center: [-9.12, 28.67], zoom: 5.2 },
  { name: "Mozambique", slug: "mozambique", center: [35.63, -18.62], zoom: 5.1 },
  { name: "Namibia", slug: "namibia", center: [18.39, -22.97], zoom: 5.5 },
  { name: "Nepal", slug: "nepal", center: [84.1, 28.3], zoom: 6.4 },
  { name: "Niger", slug: "niger", center: [8.08, 17.61], zoom: 5.5 },
  { name: "Nigeria", slug: "nigeria", center: [8.67, 8.29], zoom: 5.6 },
  { name: "Oman", slug: "oman", center: [56.5, 21.5], zoom: 5.6 },
  { name: "Pakistan", slug: "pakistan", center: [69.5, 30.0], zoom: 5.2 },
  { name: "Philippines", slug: "philippines", center: [122.0, 12.0], zoom: 5 },
  { name: "Portugal", slug: "portugal", center: [-8.2, 39.6], zoom: 6.3 },
  { name: "Qatar", slug: "qatar", center: [51.2, 25.3], zoom: 8.2 },
  { name: "Republic of the Congo", slug: "congo", center: [14.83, -0.72], zoom: 6 },
  { name: "Romania", slug: "romania", center: [25.0, 45.9], zoom: 6.5 },
  { name: "Rwanda", slug: "rwanda", center: [29.88, -1.94], zoom: 8.3 },
  { name: "São Tomé and Príncipe", slug: "sao-tome-and-principe", center: [6.97, 0.86], zoom: 8 },
  { name: "Saudi Arabia", slug: "saudi-arabia", center: [45.0, 24.0], zoom: 4.8 },
  { name: "Senegal", slug: "senegal", center: [-14.55, 14.47], zoom: 7 },
  { name: "Serbia", slug: "serbia", center: [20.8, 44.0], zoom: 6.8 },
  { name: "Seychelles", slug: "seychelles", center: [51.25, -6.99], zoom: 6.3 },
  { name: "Sierra Leone", slug: "sierra-leone", center: [-11.89, 8.38], zoom: 7.4 },
  { name: "Singapore", slug: "singapore", center: [103.82, 1.35], zoom: 10.5 },
  { name: "Somalia", slug: "somalia", center: [46.3, 5.19], zoom: 5.3 },
  { name: "South Africa", slug: "south-africa", center: [25.0, -29.0], zoom: 5.2 },
  { name: "South Korea", slug: "south-korea", center: [127.8, 36.4], zoom: 6.5 },
  { name: "South Sudan", slug: "south-sudan", center: [29.69, 7.85], zoom: 6 },
  { name: "Sri Lanka", slug: "sri-lanka", center: [80.7, 7.6], zoom: 7.2 },
  { name: "Sudan", slug: "sudan", center: [30.44, 15.35], zoom: 5.4 },
  { name: "Tajikistan", slug: "tajikistan", center: [71.0, 38.8], zoom: 6.4 },
  { name: "Tanzania", slug: "tanzania", center: [34.97, -6.38], zoom: 5.7 },
  { name: "Thailand", slug: "thailand", center: [101.0, 13.2], zoom: 5 },
  { name: "Timor-Leste", slug: "east-timor", center: [125.9, -8.8], zoom: 7.8 },
  { name: "Togo", slug: "togo", center: [0.83, 8.53], zoom: 6.7 },
  { name: "Tunisia", slug: "tunisia", center: [9.7, 34], zoom: 6.2 },
  { name: "Turkey", slug: "turkey", center: [35.0, 39.0], zoom: 5.2 },
  { name: "Turkmenistan", slug: "turkmenistan", center: [59.0, 39.0], zoom: 5.4 },
  { name: "Uganda", slug: "uganda", center: [32.29, 1.38], zoom: 6.6 },
  { name: "United Arab Emirates", slug: "united-arab-emirates", center: [54.3, 24.3], zoom: 6.8 },
  { name: "Uzbekistan", slug: "uzbekistan", center: [64.6, 41.4], zoom: 5.2 },
  { name: "Vietnam", slug: "vietnam", center: [107.0, 16.0], zoom: 5 },
  { name: "Zambia", slug: "zambia", center: [27.85, -13.18], zoom: 5.8 },
  { name: "Zimbabwe", slug: "zimbabwe", center: [29.15, -19.02], zoom: 6.3 },
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
