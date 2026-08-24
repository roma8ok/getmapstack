import type { MultiPolygon, Polygon } from 'geojson';

export function contourBounds(g: Polygon | MultiPolygon): [[number, number], [number, number]] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const rings of polygons)
    for (const ring of rings)
      for (const [x, y] of ring) {
        if (x < w) w = x;
        if (x > e) e = x;
        if (y < s) s = y;
        if (y > n) n = y;
      }
  return [[w, s], [e, n]];
}
