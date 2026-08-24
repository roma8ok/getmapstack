import type { MultiPolygon, Polygon } from 'geojson';
import { areaKm2 } from './area';
import { MINUTES, MODE_ORDER, type ModeId, type WaveData } from './isochrones';

export type Recording = {
  city: string;
  label: string;
  country: string;
  image: string;
  snapshot: string;
  origin: { lat: number; lon: number };
  wave: WaveData;
};

export class RecordingError extends Error {}

type Geometry = Polygon | MultiPolygon;

const isDrawable = (g: Geometry | undefined): boolean => {
  if (!g || !Array.isArray(g.coordinates) || g.coordinates.length === 0) return false;
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return polygons.every((rings) => rings.length > 0 && rings[0].length >= 4);
};

export async function loadRecording(
  slug: string,
  fetchFn: typeof fetch = fetch,
  baseUrl: string = import.meta.env.BASE_URL,
): Promise<Recording> {
  const url = `${baseUrl}recorded/${slug}.json`.replace(/([^:])\/\//g, '$1/');
  let body: Record<string, unknown>;
  try {
    const r = await fetchFn(url);
    if (!r.ok) throw new RecordingError(`recorded/${slug}.json: HTTP ${r.status}`);
    body = await r.json();
  } catch (e) {
    throw e instanceof RecordingError
      ? e
      : new RecordingError(`recorded/${slug}.json could not be read`);
  }

  const modes = body.modes as Record<string, Geometry[]> | undefined;
  if (!modes) throw new RecordingError(`recorded/${slug}.json has no modes`);

  const rawOrigin = body.origin as { lat?: unknown; lon?: unknown } | undefined;
  const lat = rawOrigin?.lat;
  const lon = rawOrigin?.lon;
  if (typeof lat !== 'number' || !Number.isFinite(lat) || typeof lon !== 'number' || !Number.isFinite(lon))
    throw new RecordingError(`recorded/${slug}.json has a malformed origin`);

  const wave = {} as WaveData;
  for (const mode of MODE_ORDER as ModeId[]) {
    const list = modes[mode];
    if (!Array.isArray(list) || list.length !== MINUTES.length)
      throw new RecordingError(`recorded/${slug}.json: ${mode} needs ${MINUTES.length} contours`);
    wave[mode] = MINUTES.map((minute, i) => {
      const geometry = list[i];
      if (!isDrawable(geometry))
        throw new RecordingError(`recorded/${slug}.json: ${mode} minute ${minute} is empty`);
      return { minute, geometry, areaKm2: areaKm2(geometry) };
    });
  }

  return {
    city: String(body.city ?? slug),
    label: String(body.label ?? ''),
    country: String(body.country ?? ''),
    image: String(body.image ?? ''),
    snapshot: String(body.snapshot ?? ''),
    origin: { lat, lon },
    wave,
  };
}
