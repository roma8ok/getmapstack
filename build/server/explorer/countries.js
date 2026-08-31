// One entry per published country image. What the selector actually shows is decided by
// availableCountries below: an image states its own slugs in a manifest, and a page with
// no manifest to read falls back to filtering these by the tile server's bounds. Either
// way one available country hides the selector and several show it. The centre and zoom
// are only where the map flies on a pick.
export const COUNTRIES = [
  { name: "Afghanistan", slug: "afghanistan", center: [66.4, 33.9], zoom: 5.4 },
  { name: "Albania", slug: "albania", center: [20.05, 41.15], zoom: 7.3 },
  { name: "Algeria", slug: "algeria", center: [1.66, 28.13], zoom: 4.9 },
  { name: "Andorra", slug: "andorra", center: [1.55, 42.55], zoom: 10.2 },
  { name: "Angola", slug: "angola", center: [17.77, -11.19], zoom: 5.3 },
  { name: "Argentina", slug: "argentina", center: [-64.0, -38.0], zoom: 3.4 },
  { name: "Armenia", slug: "armenia", center: [45.0, 40.2], zoom: 7.2 },
  { name: "Australia", slug: "australia", center: [134.0, -25.5], zoom: 3.6 },
  { name: "Austria", slug: "austria", center: [13.35, 47.6], zoom: 6.9 },
  { name: "Azerbaijan", slug: "azerbaijan", center: [47.8, 40.3], zoom: 6.6 },
  { name: "Bahamas", slug: "bahamas", center: [-77.4, 24.6], zoom: 6.4 },
  { name: "Bahrain", slug: "bahrain", center: [50.55, 26.05], zoom: 9.5 },
  { name: "Bangladesh", slug: "bangladesh", center: [90.3, 23.7], zoom: 6.6 },
  { name: "Belgium", slug: "belgium", center: [4.47, 50.5], zoom: 7.5 },
  { name: "Belize", slug: "belize", center: [-88.6, 17.2], zoom: 7.3 },
  { name: "Benin", slug: "benin", center: [2.31, 9.22], zoom: 6.4 },
  { name: "Bhutan", slug: "bhutan", center: [90.4, 27.4], zoom: 7.6 },
  { name: "Bolivia", slug: "bolivia", center: [-64.5, -16.5], zoom: 5.0 },
  { name: "Bosnia and Herzegovina", slug: "bosnia-herzegovina", center: [17.75, 44.1], zoom: 7.2 },
  { name: "Botswana", slug: "botswana", center: [24.69, -22.34], zoom: 5.9 },
  { name: "Brazil", slug: "brazil", center: [-51.0, -14.0], zoom: 3.4 },
  { name: "Brunei", slug: "brunei", center: [114.72, 4.53], zoom: 9 },
  { name: "Bulgaria", slug: "bulgaria", center: [25.3, 42.75], zoom: 6.9 },
  { name: "Burkina Faso", slug: "burkina-faso", center: [-1.56, 12.24], zoom: 6.6 },
  { name: "Burundi", slug: "burundi", center: [29.93, -3.39], zoom: 8 },
  { name: "Cabo Verde", slug: "cabo-verde", center: [-24.01, 16.01], zoom: 7.6 },
  { name: "Cambodia", slug: "cambodia", center: [104.9, 12.6], zoom: 6.6 },
  { name: "Cameroon", slug: "cameroon", center: [12.29, 7.37], zoom: 5.6 },
  { name: "Central African Republic", slug: "central-african-republic", center: [20.94, 6.61], zoom: 6 },
  { name: "Chad", slug: "chad", center: [18.74, 15.45], zoom: 5.1 },
  { name: "Chile", slug: "chile", center: [-71.0, -37.0], zoom: 3.3 },
  { name: "China", slug: "china", center: [104.0, 35.0], zoom: 3.6 },
  { name: "Colombia", slug: "colombia", center: [-73.5, 4.5], zoom: 4.8 },
  { name: "Comoros", slug: "comoros", center: [43.9, -12.07], zoom: 8.2 },
  { name: "Costa Rica", slug: "costa-rica", center: [-84.1, 9.9], zoom: 7.2 },
  { name: "Côte d'Ivoire", slug: "ivory-coast", center: [-5.55, 7.45], zoom: 6.4 },
  { name: "Croatia", slug: "croatia", center: [16.4, 45.1], zoom: 6.7 },
  { name: "Cyprus", slug: "cyprus", center: [33.2, 35.0], zoom: 8.5 },
  { name: "Czech Republic", slug: "czech-republic", center: [15.3, 49.8], zoom: 6.9 },
  { name: "Denmark", slug: "denmark", center: [10.0, 56.1], zoom: 6.6 },
  { name: "Djibouti", slug: "djibouti", center: [42.71, 11.85], zoom: 8.2 },
  { name: "Dominican Republic", slug: "dominican-republic", center: [-70.2, 18.8], zoom: 7.4 },
  { name: "DR Congo", slug: "dr-congo", center: [21.67, -4.03], zoom: 4.9 },
  { name: "Ecuador", slug: "ecuador", center: [-78.5, -1.5], zoom: 5.8 },
  { name: "Egypt", slug: "egypt", center: [30.88, 26.91], zoom: 5.8 },
  { name: "El Salvador", slug: "el-salvador", center: [-88.9, 13.7], zoom: 7.6 },
  { name: "Equatorial Guinea", slug: "equatorial-guinea", center: [8.41, 1.16], zoom: 6.6 },
  { name: "Eritrea", slug: "eritrea", center: [39.87, 15.21], zoom: 6.6 },
  { name: "Estonia", slug: "estonia", center: [25.5, 58.7], zoom: 7.2 },
  { name: "Eswatini", slug: "eswatini", center: [31.46, -26.52], zoom: 8.4 },
  { name: "Ethiopia", slug: "ethiopia", center: [40.49, 9.15], zoom: 5.6 },
  { name: "Fiji", slug: "fiji", center: [178.0, -17.8], zoom: 7.0 },
  { name: "Finland", slug: "finland", center: [26.0, 64.5], zoom: 5.0 },
  { name: "Gabon", slug: "gabon", center: [11.51, -0.9], zoom: 6.4 },
  { name: "Gambia", slug: "gambia", center: [-15.41, 13.44], zoom: 8 },
  { name: "Georgia", slug: "georgia", center: [43.5, 42.0], zoom: 7 },
  { name: "Ghana", slug: "ghana", center: [-0.99, 7.86], zoom: 6.4 },
  { name: "Greece", slug: "greece", center: [23.0, 39.0], zoom: 6.2 },
  { name: "Guatemala", slug: "guatemala", center: [-90.4, 15.5], zoom: 6.6 },
  { name: "Guinea", slug: "guinea", center: [-11.6, 9.93], zoom: 6.7 },
  { name: "Guinea-Bissau", slug: "guinea-bissau", center: [-15.27, 11.67], zoom: 8 },
  { name: "Guyana", slug: "guyana", center: [-58.9, 4.9], zoom: 6.0 },
  { name: "Haiti", slug: "haiti", center: [-72.4, 19.0], zoom: 7.6 },
  { name: "Honduras", slug: "honduras", center: [-86.5, 14.8], zoom: 6.6 },
  { name: "Hungary", slug: "hungary", center: [19.4, 47.15], zoom: 7.0 },
  { name: "Iceland", slug: "iceland", center: [-18.5, 64.9], zoom: 6.0 },
  { name: "India", slug: "india", center: [79.0, 22.5], zoom: 4.2 },
  { name: "Indonesia", slug: "indonesia", center: [117.0, -2.5], zoom: 4.2 },
  { name: "Iraq", slug: "iraq", center: [43.7, 33.2], zoom: 6.0 },
  { name: "Ireland", slug: "ireland", center: [-8.0, 53.4], zoom: 6.9 },
  { name: "Israel", slug: "israel", center: [34.95, 31.5], zoom: 7.4 },
  { name: "Italy", slug: "italy", center: [12.6, 42.5], zoom: 5.4 },
  { name: "Jamaica", slug: "jamaica", center: [-77.3, 18.1], zoom: 8.0 },
  { name: "Japan", slug: "japan", center: [138.0, 37.5], zoom: 4.8 },
  { name: "Jordan", slug: "jordan", center: [36.2, 31.3], zoom: 7.0 },
  { name: "Kazakhstan", slug: "kazakhstan", center: [67.0, 48.0], zoom: 4.2 },
  { name: "Kenya", slug: "kenya", center: [37.91, -0.14], zoom: 5.9 },
  { name: "Kiribati", slug: "kiribati", center: [173.02, 1.35], zoom: 9.4 },
  { name: "Kuwait", slug: "kuwait", center: [47.8, 29.3], zoom: 8.2 },
  { name: "Kyrgyzstan", slug: "kyrgyzstan", center: [74.6, 41.2], zoom: 6.2 },
  { name: "Laos", slug: "laos", center: [103.8, 18.3], zoom: 5.6 },
  { name: "Latvia", slug: "latvia", center: [24.6, 56.9], zoom: 7.2 },
  { name: "Lebanon", slug: "lebanon", center: [35.85, 33.9], zoom: 8.2 },
  { name: "Lesotho", slug: "lesotho", center: [28.23, -29.62], zoom: 8 },
  { name: "Liberia", slug: "liberia", center: [-9.49, 6.35], zoom: 7 },
  { name: "Libya", slug: "libya", center: [17.38, 26.43], zoom: 5.3 },
  { name: "Liechtenstein", slug: "liechtenstein", center: [9.55, 47.16], zoom: 10.8 },
  { name: "Lithuania", slug: "lithuania", center: [23.9, 55.3], zoom: 7.2 },
  { name: "Luxembourg", slug: "luxembourg", center: [6.13, 49.77], zoom: 9.2 },
  { name: "Madagascar", slug: "madagascar", center: [46.82, -18.76], zoom: 5.3 },
  { name: "Malawi", slug: "malawi", center: [34.3, -13.25], zoom: 6.2 },
  { name: "Malaysia", slug: "malaysia", center: [109.5, 3.6], zoom: 5.2 },
  { name: "Maldives", slug: "maldives", center: [73.4, 3.5], zoom: 6.4 },
  { name: "Mali", slug: "mali", center: [-3.99, 17.57], zoom: 5.2 },
  { name: "Malta", slug: "malta", center: [14.4, 35.92], zoom: 10.4 },
  { name: "Marshall Islands", slug: "marshall-islands", center: [171.28, 7.12], zoom: 9.8 },
  { name: "Mauritania", slug: "mauritania", center: [-11.04, 21.02], zoom: 5.5 },
  { name: "Mauritius", slug: "mauritius", center: [60.05, -15.43], zoom: 5.7 },
  { name: "Mexico", slug: "mexico", center: [-102.0, 23.5], zoom: 4.2 },
  { name: "Micronesia", slug: "micronesia", center: [158.22, 6.88], zoom: 9.2 },
  { name: "Moldova", slug: "moldova", center: [28.5, 47.2], zoom: 7.3 },
  { name: "Monaco", slug: "monaco", center: [7.42, 43.74], zoom: 12.5 },
  { name: "Mongolia", slug: "mongolia", center: [103.5, 46.8], zoom: 4.4 },
  { name: "Montenegro", slug: "montenegro", center: [19.25, 42.8], zoom: 8.2 },
  { name: "Morocco", slug: "morocco", center: [-9.12, 28.67], zoom: 5.2 },
  { name: "Mozambique", slug: "mozambique", center: [35.63, -18.62], zoom: 5.1 },
  { name: "Namibia", slug: "namibia", center: [18.39, -22.97], zoom: 5.5 },
  { name: "Nauru", slug: "nauru", center: [166.93, -0.523], zoom: 11.8 },
  { name: "Nepal", slug: "nepal", center: [84.1, 28.3], zoom: 6.4 },
  { name: "Netherlands", slug: "netherlands", center: [5.6, 52.2], zoom: 7.0 },
  { name: "New Zealand", slug: "new-zealand", center: [172.5, -41.0], zoom: 4.6 },
  { name: "Nicaragua", slug: "nicaragua", center: [-85.2, 12.9], zoom: 6.6 },
  { name: "Niger", slug: "niger", center: [8.08, 17.61], zoom: 5.5 },
  { name: "Nigeria", slug: "nigeria", center: [8.67, 8.29], zoom: 5.6 },
  { name: "North Macedonia", slug: "north-macedonia", center: [21.7, 41.6], zoom: 7.6 },
  { name: "Norway", slug: "norway", center: [15.0, 65.0], zoom: 4.4 },
  { name: "Oman", slug: "oman", center: [56.5, 21.5], zoom: 5.6 },
  { name: "Pakistan", slug: "pakistan", center: [69.5, 30.0], zoom: 5.2 },
  { name: "Palau", slug: "palau", center: [134.52, 7.42], zoom: 8.8 },
  { name: "Panama", slug: "panama", center: [-80.1, 8.6], zoom: 6.7 },
  { name: "Papua New Guinea", slug: "papua-new-guinea", center: [146.5, -6.5], zoom: 5.2 },
  { name: "Paraguay", slug: "paraguay", center: [-58.4, -23.4], zoom: 5.4 },
  { name: "Peru", slug: "peru", center: [-75.0, -9.5], zoom: 4.6 },
  { name: "Philippines", slug: "philippines", center: [122.0, 12.0], zoom: 5 },
  { name: "Poland", slug: "poland", center: [19.3, 52.0], zoom: 6.2 },
  { name: "Portugal", slug: "portugal", center: [-8.2, 39.6], zoom: 6.3 },
  { name: "Qatar", slug: "qatar", center: [51.2, 25.3], zoom: 8.2 },
  { name: "Republic of the Congo", slug: "congo", center: [14.83, -0.72], zoom: 6 },
  { name: "Romania", slug: "romania", center: [25.0, 45.9], zoom: 6.5 },
  { name: "Rwanda", slug: "rwanda", center: [29.88, -1.94], zoom: 8.3 },
  { name: "Samoa", slug: "samoa", center: [-172.1, -13.8], zoom: 8.4 },
  { name: "São Tomé and Príncipe", slug: "sao-tome-and-principe", center: [6.97, 0.86], zoom: 8 },
  { name: "Saudi Arabia", slug: "saudi-arabia", center: [45.0, 24.0], zoom: 4.8 },
  { name: "Senegal", slug: "senegal", center: [-14.55, 14.47], zoom: 7 },
  { name: "Serbia", slug: "serbia", center: [20.8, 44.0], zoom: 6.8 },
  { name: "Seychelles", slug: "seychelles", center: [51.25, -6.99], zoom: 6.3 },
  { name: "Sierra Leone", slug: "sierra-leone", center: [-11.89, 8.38], zoom: 7.4 },
  { name: "Singapore", slug: "singapore", center: [103.82, 1.35], zoom: 10.5 },
  { name: "Slovakia", slug: "slovakia", center: [19.5, 48.7], zoom: 7.2 },
  { name: "Slovenia", slug: "slovenia", center: [14.85, 46.15], zoom: 7.9 },
  { name: "Solomon Islands", slug: "solomon-islands", center: [160.5, -9.0], zoom: 5.8 },
  { name: "Somalia", slug: "somalia", center: [46.3, 5.19], zoom: 5.3 },
  { name: "South Africa", slug: "south-africa", center: [25.0, -29.0], zoom: 5.2 },
  { name: "South Korea", slug: "south-korea", center: [127.8, 36.4], zoom: 6.5 },
  { name: "South Sudan", slug: "south-sudan", center: [29.69, 7.85], zoom: 6 },
  { name: "Spain", slug: "spain", center: [-3.6, 40.2], zoom: 5.6 },
  { name: "Sri Lanka", slug: "sri-lanka", center: [80.7, 7.6], zoom: 7.2 },
  { name: "Sudan", slug: "sudan", center: [30.44, 15.35], zoom: 5.4 },
  { name: "Suriname", slug: "suriname", center: [-55.9, 4.1], zoom: 6.3 },
  { name: "Sweden", slug: "sweden", center: [16.5, 62.5], zoom: 4.8 },
  { name: "Switzerland", slug: "switzerland", center: [8.2, 46.8], zoom: 7.2 },
  { name: "Tajikistan", slug: "tajikistan", center: [71.0, 38.8], zoom: 6.4 },
  { name: "Tanzania", slug: "tanzania", center: [34.97, -6.38], zoom: 5.7 },
  { name: "Thailand", slug: "thailand", center: [101.0, 13.2], zoom: 5 },
  { name: "Timor-Leste", slug: "east-timor", center: [125.9, -8.8], zoom: 7.8 },
  { name: "Togo", slug: "togo", center: [0.83, 8.53], zoom: 6.7 },
  { name: "Tonga", slug: "tonga", center: [-175.19, -21.16], zoom: 9.0 },
  { name: "Tunisia", slug: "tunisia", center: [9.7, 34], zoom: 6.2 },
  { name: "Turkey", slug: "turkey", center: [35.0, 39.0], zoom: 5.2 },
  { name: "Turkmenistan", slug: "turkmenistan", center: [59.0, 39.0], zoom: 5.4 },
  { name: "Tuvalu", slug: "tuvalu", center: [179.1962, -8.5211], zoom: 10.2 },
  { name: "Uganda", slug: "uganda", center: [32.29, 1.38], zoom: 6.6 },
  { name: "United Arab Emirates", slug: "united-arab-emirates", center: [54.3, 24.3], zoom: 6.8 },
  { name: "United Kingdom", slug: "united-kingdom", center: [-3.5, 55.0], zoom: 5 },
  { name: "Uruguay", slug: "uruguay", center: [-56.0, -32.8], zoom: 6.3 },
  { name: "Uzbekistan", slug: "uzbekistan", center: [64.6, 41.4], zoom: 5.2 },
  { name: "Vanuatu", slug: "vanuatu", center: [167.8, -16.5], zoom: 6.2 },
  { name: "Venezuela", slug: "venezuela", center: [-66.0, 7.0], zoom: 5.0 },
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
