import { MINUTES, MODE_ORDER, type ModeId, type WaveData } from '../lib/isochrones';

export const WAVE_COLORS: Record<ModeId, string> = { car: '#46d4f5', bike: '#f56ab0', walk: '#ffc35c' };

const FILL_ALPHA = 0.12;
const GLOW_ALPHA = 0.5;

// Numeric feature-state MUST go through coalesce: a bare assertion silently
// falls back to the default because a number is not a boolean.
const fs = (key: string, scale: number) => ['*', scale, ['coalesce', ['feature-state', key], 0]];

export function waveSources(data: WaveData): Record<string, unknown> {
  return Object.fromEntries(
    MODE_ORDER.map((m) => [
      `wave-${m}`,
      {
        type: 'geojson',
        promoteId: 'minute',
        data: {
          type: 'FeatureCollection',
          features: data[m].map((c) => ({
            type: 'Feature',
            properties: { minute: c.minute },
            geometry: c.geometry,
          })),
        },
      },
    ]),
  );
}

export function waveLayers(): { id: string; [k: string]: unknown }[] {
  return [
    ...MODE_ORDER.map((m) => ({
      id: `wave-fill-${m}`, type: 'fill', source: `wave-${m}`,
      paint: { 'fill-color': WAVE_COLORS[m], 'fill-opacity': fs('fill', FILL_ALPHA) },
    })),
    ...MODE_ORDER.map((m) => ({
      id: `wave-glow-${m}`, type: 'line', source: `wave-${m}`,
      paint: {
        'line-color': WAVE_COLORS[m], 'line-width': 10, 'line-blur': 6,
        'line-opacity': fs('front', GLOW_ALPHA),
      },
    })),
    ...MODE_ORDER.map((m) => ({
      id: `wave-front-${m}`, type: 'line', source: `wave-${m}`,
      paint: { 'line-color': WAVE_COLORS[m], 'line-width': 2.2, 'line-opacity': fs('front', 0.95) },
    })),
  ];
}

const GHOSTS = [0.25, 0.12, 0.05];

export function frameStates(t: number): { minute: number; fill: number; front: number }[] {
  const m = Math.floor(t / 60);
  const p = (t - m * 60) / 60;
  return MINUTES.map((minute) => {
    let fill = 0;
    let front = 0;
    if (minute === m) { fill = 1 - p; front = 1 - p; }
    if (minute === m + 1 && minute <= MINUTES.length) {
      fill = Math.max(fill, p);
      front = Math.max(front, p);
    }
    const age = m - minute;
    if (age >= 1 && age <= GHOSTS.length) front = Math.max(front, GHOSTS[age - 1]);
    return { minute, fill, front };
  });
}

export function applyFrame(
  map: { setFeatureState(target: { source: string; id: number }, state: { fill: number; front: number }): void },
  t: number,
): void {
  const states = frameStates(t);
  for (const m of MODE_ORDER)
    for (const s of states)
      map.setFeatureState({ source: `wave-${m}`, id: s.minute }, { fill: s.fill, front: s.front });
}
