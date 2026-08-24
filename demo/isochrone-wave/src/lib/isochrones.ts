import type { MultiPolygon, Polygon } from 'geojson';
import { areaKm2 } from './area';

export const MODES = [
  { id: 'car', costing: 'auto', label: 'Car', icon: '🚗' },
  { id: 'bike', costing: 'bicycle', label: 'Bicycle', icon: '🚲' },
  { id: 'walk', costing: 'pedestrian', label: 'On foot', icon: '🚶' },
] as const;

export type ModeId = (typeof MODES)[number]['id'];
export const MODE_ORDER: ModeId[] = ['car', 'bike', 'walk'];

export const MINUTES = Array.from({ length: 15 }, (_, i) => i + 1);

export type MinuteContour = { minute: number; geometry: Polygon | MultiPolygon; areaKm2: number };
export type WaveData = Record<ModeId, MinuteContour[]>;

export class WaveError extends Error {}

export function chunkContours(minutes: number[], max = 4): number[][] {
  const sorted = [...minutes].sort((a, b) => a - b);
  const chunks: number[][] = [];
  for (let i = 0; i < sorted.length; i += max) chunks.push(sorted.slice(i, i + max));
  return chunks;
}

type LatLon = { lat: number; lon: number };

async function fetchChunk(
  base: string,
  costing: string,
  origin: LatLon,
  minutes: number[],
  fetchFn: typeof fetch,
): Promise<Map<number, Polygon | MultiPolygon>> {
  // No Content-Type header on purpose: keeps the request CORS-simple, and the
  // engine reads the body regardless. No contour colours: the page draws itself.
  const resp = await fetchFn(`${base}/valhalla/isochrone`, {
    method: 'POST',
    body: JSON.stringify({
      locations: [{ lat: origin.lat, lon: origin.lon }],
      costing,
      contours: minutes.map((time) => ({ time })),
      polygons: true,
    }),
  });
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const e = await resp.json();
      if (e && typeof e.error === 'string') detail = e.error;
    } catch { /* keep the status text */ }
    throw new WaveError(detail);
  }
  const fc = await resp.json();
  const out = new Map<number, Polygon | MultiPolygon>();
  for (const f of fc.features ?? []) out.set(Math.round(f.properties.contour), f.geometry);
  return out;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    try {
      return await fn();
    } catch (e2) {
      throw e2 instanceof WaveError ? e2 : new WaveError(e2 instanceof Error ? e2.message : String(e2));
    }
  }
}

export async function fetchWave(
  base: string,
  origin: LatLon,
  fetchFn: typeof fetch = fetch,
): Promise<WaveData> {
  const chunks = chunkContours(MINUTES);
  const perMode = MODES.map(async (mode) => {
    const maps = await Promise.all(
      chunks.map((c) => withRetry(() => fetchChunk(base, mode.costing, origin, c, fetchFn))),
    );
    const merged = new Map<number, Polygon | MultiPolygon>();
    for (const m of maps) for (const [k, v] of m) merged.set(k, v);
    const contours = MINUTES.map((minute) => {
      const geometry = merged.get(minute);
      if (!geometry) throw new WaveError(`minute ${minute} missing from the ${mode.costing} answer`);
      return { minute, geometry, areaKm2: areaKm2(geometry) };
    });
    return [mode.id, contours] as const;
  });
  return Object.fromEntries(await Promise.all(perMode)) as WaveData;
}

export function areaAt(contours: MinuteContour[], t: number): number {
  const m = Math.floor(t / 60);
  const p = (t - m * 60) / 60;
  const a = (min: number) => (min <= 0 ? 0 : contours[Math.min(min, contours.length) - 1].areaKm2);
  if (m >= contours.length) return a(contours.length);
  return a(m) + (a(m + 1) - a(m)) * p;
}
