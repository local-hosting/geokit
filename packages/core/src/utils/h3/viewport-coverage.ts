/**
 * Viewport H3 tessellation filtered by a coverage cell index.
 */

import { cellToBoundary } from 'h3-js';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { expandH3CellId } from './cell-id.js';
import { h3CellsForViewportBounds, type ViewportBounds } from './viewport.js';
import { normalizeH3CellToResolution } from './cell-id-resolution.js';

export type { ViewportBounds };

export const DEFAULT_MAX_H3_HEX_POLYGONS = 120;
export const DEFAULT_MAX_VIEWPORT_H3_EVAL = 1500;

export type H3CellPolygonOptions = {
  properties?: (cellId: string) => Record<string, unknown>;
};

export function h3CellToPolygonFeature(
  h3: string,
  options: H3CellPolygonOptions = {}
): Feature<Polygon> {
  const id = h3.trim().toLowerCase();
  const boundary = cellToBoundary(expandH3CellId(id));
  const ring = boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
  if (ring.length > 0) ring.push(ring[0]!);
  return {
    type: 'Feature',
    properties: { h3: id, ...(options.properties?.(id) ?? {}) },
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

export function h3CellsForViewport(
  bounds: ViewportBounds,
  resolution: number,
  options?: {
    maxEvalCells?: number;
    fallbackDiskK?: number;
    centerLat?: number;
    centerLng?: number;
  }
): string[] {
  return h3CellsForViewportBounds(bounds, {
    resolution,
    centerLat: options?.centerLat,
    centerLng: options?.centerLng,
    fallbackDiskK: options?.fallbackDiskK ?? 2,
    maxEvalCells: options?.maxEvalCells ?? DEFAULT_MAX_VIEWPORT_H3_EVAL,
  });
}

export function filterCellsInCoverage(
  cells: string[],
  coverageIndex: Set<string>,
  resolution: number
): string[] {
  const normalizedIndex = new Set(
    [...coverageIndex].map((cell) => normalizeH3CellToResolution(cell, resolution))
  );
  return cells.filter((c) => {
    const normalized = normalizeH3CellToResolution(c.trim().toLowerCase(), resolution);
    return Boolean(normalized && normalizedIndex.has(normalized));
  });
}

export function viewportCoverageCells(
  bounds: ViewportBounds,
  coverageIndex: Set<string>,
  resolution: number,
  options?: {
    maxEvalCells?: number;
    centerLat?: number;
    centerLng?: number;
  }
): string[] {
  return filterCellsInCoverage(
    h3CellsForViewport(bounds, resolution, {
      maxEvalCells: options?.maxEvalCells,
      centerLat: options?.centerLat,
      centerLng: options?.centerLng,
    }),
    coverageIndex,
    resolution
  );
}

export function h3CoveragePolygonCollection(
  cells: Iterable<string>,
  options: H3CellPolygonOptions & { maxFeatures?: number } = {}
): FeatureCollection<Polygon> {
  const max = options.maxFeatures ?? DEFAULT_MAX_H3_HEX_POLYGONS;
  const features: Feature<Polygon>[] = [];
  for (const h3 of cells) {
    const cell = h3.trim().toLowerCase();
    if (!cell) continue;
    features.push(h3CellToPolygonFeature(cell, options));
    if (features.length >= max) break;
  }
  return { type: 'FeatureCollection', features };
}
