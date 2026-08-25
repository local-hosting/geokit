import type { MultiPolygon, Polygon, Position } from 'geojson';
import type { LatLon } from '../types.js';
import { polygonCentroid } from '../geometry/polygon-centroid.js';
import { coordinatesToH3 } from '../geometry/core';
import { compactH3CellId } from '../cell/cell-id';
import { polygonToH3 } from '../geometry/polygon';

export type H3CellValueMap<T extends string = string> = Readonly<
  Record<string, readonly T[] | T[]>
>;

export type PolygonToH3CellsOptions = {
  /** Sample vertices on the outer ring to catch edge cells (default true). */
  sampleVertices?: boolean;
  /** Target vertex samples along the outer ring (default 8). */
  vertexSampleCount?: number;
};

export type JoinCellMapToPolygonOptions = PolygonToH3CellsOptions & {
  /** Try the polygon centroid cell when covering cells yield no values (default true). */
  centroidFallback?: boolean;
  /** Normalize cell ids before map lookup (default compact H3 id). */
  normalizeCellId?: (cell: string) => string | null;
};

function outerRing(geometry: Polygon | MultiPolygon): Position[] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates[0] ?? [];
  }
  return geometry.coordinates[0]?.[0] ?? [];
}

function geometryCentroidLatLon(geometry: Polygon | MultiPolygon): LatLon | null {
  if (geometry.type === 'Polygon') {
    return polygonCentroid(geometry);
  }

  let best: LatLon | null = null;
  let bestRingLength = 0;
  for (const polygonCoords of geometry.coordinates) {
    const ring = polygonCoords[0] ?? [];
    if (ring.length > bestRingLength) {
      const polygon: Polygon = { type: 'Polygon', coordinates: polygonCoords };
      best = polygonCentroid(polygon);
      bestRingLength = ring.length;
    }
  }
  return best;
}

function sampleVertexCells(
  ring: Position[],
  resolution: number,
  vertexSampleCount: number,
  cells: Set<string>,
): void {
  if (ring.length < 3) return;

  const toH3 = coordinatesToH3(resolution);
  const sampleInterval = Math.max(1, Math.floor(ring.length / vertexSampleCount));
  for (let i = 0; i < ring.length; i += sampleInterval) {
    const position = ring[i];
    if (!position) continue;
    const [lng, lat] = position;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    try {
      cells.add(toH3([lat, lng]));
    } catch {
      // Skip invalid coordinates.
    }
  }
}

/**
 * H3 cells that cover a polygon or multipolygon, including optional vertex samples.
 */
export function polygonGeometryToH3Cells(
  geometry: Polygon | MultiPolygon,
  resolution: number,
  options?: PolygonToH3CellsOptions,
): string[] {
  const sampleVertices = options?.sampleVertices ?? true;
  const vertexSampleCount = options?.vertexSampleCount ?? 8;
  const cells = new Set<string>();

  if (geometry.type === 'Polygon') {
    for (const cell of polygonToH3(geometry, resolution)) {
      cells.add(cell);
    }
  } else {
    for (const polygonCoords of geometry.coordinates) {
      const polygon: Polygon = { type: 'Polygon', coordinates: polygonCoords };
      for (const cell of polygonToH3(polygon, resolution)) {
        cells.add(cell);
      }
    }
  }

  if (sampleVertices) {
    sampleVertexCells(outerRing(geometry), resolution, vertexSampleCount, cells);
  }

  return [...cells];
}

function defaultNormalizeCellId(cell: string): string | null {
  return compactH3CellId(cell);
}

function valuesForCell<T extends string>(
  cell: string,
  cellToValues: H3CellValueMap<T>,
  normalizeCellId: (cell: string) => string | null,
  out: Set<T>,
): void {
  const normalized = normalizeCellId(cell);
  if (!normalized) return;
  const values = cellToValues[normalized] ?? cellToValues[cell];
  if (!values?.length) return;
  for (const value of values) {
    out.add(value);
  }
}

/**
 * Collect deduplicated values from an H3 cell map for the given cells.
 */
export function lookupValuesForH3Cells<T extends string>(
  cells: Iterable<string>,
  cellToValues: H3CellValueMap<T>,
  options?: { normalizeCellId?: (cell: string) => string | null },
): T[] {
  const normalizeCellId = options?.normalizeCellId ?? defaultNormalizeCellId;
  const out = new Set<T>();
  for (const cell of cells) {
    valuesForCell(cell, cellToValues, normalizeCellId, out);
  }
  return [...out].sort();
}

/**
 * Spatial join: polygon geometry → covering H3 cells → values from a cell map.
 */
export function joinCellMapToPolygon<T extends string>(
  geometry: Polygon | MultiPolygon,
  cellToValues: H3CellValueMap<T>,
  resolution: number,
  options?: JoinCellMapToPolygonOptions,
): T[] {
  const normalizeCellId = options?.normalizeCellId ?? defaultNormalizeCellId;
  const centroidFallback = options?.centroidFallback ?? true;
  const cells = polygonGeometryToH3Cells(geometry, resolution, options);
  const out = new Set<T>();

  for (const cell of cells) {
    valuesForCell(cell, cellToValues, normalizeCellId, out);
  }

  if (out.size === 0 && centroidFallback) {
    const centroid = geometryCentroidLatLon(geometry);
    if (centroid) {
      try {
        const centroidCell = coordinatesToH3(resolution)(centroid);
        valuesForCell(centroidCell, cellToValues, normalizeCellId, out);
      } catch {
        // Skip invalid centroid.
      }
    }
  }

  return [...out].sort();
}
