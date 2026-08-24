import type { MultiPolygon, Polygon, Position } from 'geojson';

const R = 6371008.8; // mean Earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180;

// Chamberlain & Duquette spherical excess; signed, so |.| before use.
function ringAreaM2(ring: Position[]): number {
  if (ring.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[(i + 1) % ring.length];
    total += rad(lon2 - lon1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  return (total * R * R) / 2;
}

export function areaKm2(g: Polygon | MultiPolygon): number {
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let m2 = 0;
  for (const rings of polygons) {
    if (!rings.length) continue;
    m2 += Math.abs(ringAreaM2(rings[0]));
    for (const hole of rings.slice(1)) m2 -= Math.abs(ringAreaM2(hole));
  }
  return Math.max(0, m2) / 1e6;
}
