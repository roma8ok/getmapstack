import { describe, expect, test } from 'vitest';
import type { MultiPolygon, Polygon } from 'geojson';
import { areaKm2 } from './area';

const square = (size: number): [number, number][] => [
  [0, 0], [size, 0], [size, size], [0, size], [0, 0],
];

describe('areaKm2', () => {
  test('1x1 degree square at the equator is about 12363 km2', () => {
    const p: Polygon = { type: 'Polygon', coordinates: [square(1)] };
    expect(areaKm2(p)).toBeCloseTo(12363, -2); // within ~50 km2
  });

  test('holes are subtracted', () => {
    const hole: [number, number][] = [
      [0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75], [0.25, 0.25],
    ];
    const p: Polygon = { type: 'Polygon', coordinates: [square(1), hole] };
    const full = areaKm2({ type: 'Polygon', coordinates: [square(1)] });
    expect(areaKm2(p)).toBeCloseTo(full * 0.75, 0);
  });

  test('MultiPolygon sums its parts', () => {
    const m: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [[square(1)], [square(1).map(([x, y]) => [x + 2, y] as [number, number])]],
    };
    expect(areaKm2(m)).toBeCloseTo(2 * 12363, -3);
  });

  test('ring winding does not matter', () => {
    const cw: Polygon = { type: 'Polygon', coordinates: [[...square(1)].reverse()] };
    expect(areaKm2(cw)).toBeCloseTo(12363, -2);
  });
});
