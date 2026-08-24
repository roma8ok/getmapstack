import countries from '../data/countries.json';

export type Country = { name: string; slug: string };

export const COUNTRIES = countries as Country[];

// The one place the page spells the registry address: the command the run panel
// hands out, and the provenance stamp every recorded fixture carries. The
// recorder repeats the literal because a .mjs script cannot import this file -
// its own test pins the two together.
export const imageFor = (slug: string): string => `ghcr.io/roma8ok/getmapstack/${slug}`;

// The picker speaks slugs (they are what the docker command needs); the badge
// over a live map speaks the name. An unknown slug - a container the visitor
// pointed us at by hand - falls back to itself rather than to nothing.
export function countryName(slug: string): string {
  return COUNTRIES.find((c) => c.slug === slug)?.name ?? slug;
}

// What the connected container actually serves - the image lists its own
// countries at /countries.json. A visitor can point the page at a container
// other than the one they picked in the panel, and the badge over a live map
// has to name the map, not the intention. Anything unexpected answers null and
// the caller keeps the picked slug.
export async function fetchServedCountry(
  base: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const r = await fetchFn(`${base}/countries.json`);
    if (!r.ok) return null;
    const body = await r.json();
    const first = body?.countries?.[0];
    return typeof first === 'string' && first ? first : null;
  } catch {
    return null;
  }
}
