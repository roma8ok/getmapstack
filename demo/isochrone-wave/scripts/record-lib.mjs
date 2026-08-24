// Pure helpers of the recorder, kept separate so they are testable without a
// container. record.mjs is the shell around these.

export const CHUNKS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15]];
export const COSTINGS = { car: 'auto', bike: 'bicycle', walk: 'pedestrian' };

export function isoDate(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

export function assertCountry(manifest, expected) {
  const listed = manifest?.countries ?? [];
  if (!listed.includes(expected))
    throw new Error(
      `the container serves [${listed.join(', ')}], not ${expected} - ` +
        `a wave recorded from the wrong image is fifteen empty contours`,
    );
}

export function collectGeometries(responses) {
  const byMinute = new Map();
  for (const fc of responses)
    for (const f of fc.features ?? []) byMinute.set(Math.round(f.properties.contour), f.geometry);
  return CHUNKS.flat().map((minute) => {
    const g = byMinute.get(minute);
    if (!g) throw new Error(`minute ${minute} missing from the answer`);
    return g;
  });
}

export function buildFixture(city, meta, modes) {
  return {
    city: city.name,
    label: city.label,
    country: city.country,
    // The pullable address, not the local build tag: a fixture's provenance is
    // only useful if someone can fetch the image it names. Kept in step with
    // imageFor() in src/lib/countries.ts by this file's test.
    image: `ghcr.io/roma8ok/getmapstack/${city.country}`,
    snapshot: meta.snapshot,
    valhalla: meta.valhalla,
    origin: city.origin,
    modes,
  };
}
