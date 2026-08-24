export type StyleSpec = {
  glyphs?: string;
  sprite?: string | { id: string; url: string }[];
  sources: Record<string, { url?: string; tiles?: string[]; [k: string]: unknown }>;
  layers: unknown[];
  [k: string]: unknown;
};

export async function fetchTileJson(
  base: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ bounds?: number[]; center?: number[] }> {
  const r = await fetchFn(`${base}/martin/basemap`);
  if (!r.ok) throw new Error(`tilejson: HTTP ${r.status}`);
  return r.json();
}
