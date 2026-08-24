import { describe, expect, test } from 'vitest';
import type { MultiPolygon, Polygon } from 'geojson';
import { contourBounds } from './camera';

describe('contourBounds', () => {
  test('finds the extremes of a polygon', () => {
    const p: Polygon = {
      type: 'Polygon',
      coordinates: [[[33.1, 35.0], [33.5, 35.2], [33.3, 34.9], [33.1, 35.0]]],
    };
    expect(contourBounds(p)).toEqual([[33.1, 34.9], [33.5, 35.2]]);
  });
  test('spans all parts of a MultiPolygon', () => {
    const m: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [[[0, 0], [1, 0], [1, 1], [0, 0]]],
        [[[5, 5], [6, 5], [6, 6], [5, 5]]],
      ],
    };
    expect(contourBounds(m)).toEqual([[0, 0], [6, 6]]);
  });
});
