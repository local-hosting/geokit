import {
  cellsToMultiPolygon,
  polygonToCellsExperimental,
} from 'h3-js';
import type { Polygon } from '../types';

/**
 * Convert H3 cells to a GeoJSON MultiPolygon
 *
 * @param h3Indices - Array of H3 cell IDs
 * @returns GeoJSON MultiPolygon geometry with [lng, lat] coordinates
 *
 * @example
 * ```typescript
 * const multiPolygon = h3SetToMultiPolygon(['892a1072c97ffff', '892a1072c87ffff']);
 * ```
 */
export function h3SetToMultiPolygon(h3Indices: string[]): {
  type: 'MultiPolygon';
  coordinates: number[][][][];
} {
  // h3-js cellsToMultiPolygon:
  // - Without flag: returns [lat, lng] (H3 native format)
  // - With formatAsGeoJson=true: returns [lng, lat] (GeoJSON format)
  // We need GeoJSON format, so pass true
  // h3-js rejects duplicate cell ids in cellsToMultiPolygon.
  const uniqueIndices = [...new Set(h3Indices)];
  const coords = cellsToMultiPolygon(uniqueIndices, true);

  return {
    type: 'MultiPolygon',
    coordinates: coords,
  };
}

/**
 * Fill interior holes left after tessellation (missing cells completely
 * enclosed by the selected set). Iterates until stable.
 */
export function fillInteriorH3Holes(
  cells: readonly string[],
  resolution: number,
): string[] {
  const set = new Set(cells);
  if (set.size === 0) return [];

  let grew = true;
  while (grew) {
    grew = false;
    const mp = cellsToMultiPolygon([...set], true);
    for (const poly of mp) {
      // poly[0] = outer ring; poly[1..] = holes
      for (let i = 1; i < poly.length; i++) {
        const holeRing = poly[i];
        if (!holeRing || holeRing.length < 4) continue;
        let holeCells: string[];
        try {
          holeCells = polygonToCellsExperimental(
            [holeRing],
            resolution,
            'containmentOverlapping',
            true,
          );
        } catch {
          continue;
        }
        for (const cell of holeCells) {
          if (!set.has(cell)) {
            set.add(cell);
            grew = true;
          }
        }
      }
    }
  }

  return [...set];
}

/**
 * Fill a polygon with H3 cells
 *
 * @param polygon - GeoJSON Polygon
 * @param resolution - H3 resolution
 * @returns Array of H3 cell IDs covering the polygon
 *
 * @example
 * ```typescript
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [[[-74.01, 40.7], [-74.0, 40.7], [-74.0, 40.71], [-74.01, 40.71], [-74.01, 40.7]]]
 * };
 * const cells = polygonToH3(polygon, 9);
 * ```
 */
export function polygonToH3(polygon: Polygon, resolution: number): string[] {
  // Overlapping containment — not center-only — so clipped hexes still fill.
  // Then fill any enclosed holes so irregular isochrone outlines don't leave
  // Swiss-cheese gaps after dissolve.
  let cells: string[];
  try {
    cells = polygonToCellsExperimental(
      polygon.coordinates,
      resolution,
      'containmentOverlapping',
      true,
    );
  } catch {
    return [];
  }
  return fillInteriorH3Holes(cells, resolution);
}
