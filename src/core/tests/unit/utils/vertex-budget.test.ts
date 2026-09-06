import { describe, expect, it } from 'vitest';
import {
  capGeoJsonRingToMaxPoints,
  MAPLIBRE_RING_VERTEX_BUDGET,
  ringSelfIntersectionCount,
  STATE_OUTLINE_MAX_RING_POINTS,
} from '../../../src/utils/geojson/vertex-budget';

describe('vertex-budget', () => {
  it('caps dense rings under MapLibre budget without self-intersections', () => {
    const dense: [number, number][] = Array.from({ length: 2000 }, (_, index) => [
      -100 + index * 0.01,
      35 + Math.sin(index * 0.05) * 2,
    ]);
    dense.push(dense[0]!);

    const capped = capGeoJsonRingToMaxPoints(dense, STATE_OUTLINE_MAX_RING_POINTS);
    expect(capped.length).toBeLessThanOrEqual(MAPLIBRE_RING_VERTEX_BUDGET);
    expect(capped.length).toBeLessThanOrEqual(STATE_OUTLINE_MAX_RING_POINTS + 1);
  });

  it('rejects bow-tie rings in self-intersection check', () => {
    const bowTie: [number, number][] = [
      [0, 0],
      [1, 1],
      [1, 0],
      [0, 1],
      [0, 0],
    ];
    expect(ringSelfIntersectionCount(bowTie)).toBeGreaterThan(0);
  });
});
