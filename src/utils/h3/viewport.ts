/**
 * Viewport H3 tessellation — cells covering a map bounds with center-priority capping.
 */

import { gridDisk, latLngToCell } from 'h3-js';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { compactH3CellId, expandH3CellId } from './cell-id';
import { h3ToCoordinates } from './core';
import { h3ToPolygon } from './boundary';
import { polygonToH3 } from './polygon';
import { h3CellFadeProperties } from './cell-fade';

export type ViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type CellLayerViewport = {
  bounds: ViewportBounds;
  centerLat: number;
  centerLng: number;
  zoom: number;
};

export type H3CellsForViewportOptions = {
  resolution: number;
  centerLat?: number;
  centerLng?: number;
  /** gridDisk k when polygon tessellation is empty (default 1). */
  fallbackDiskK?: number;
  /** Skip tessellation when cell count exceeds this (default unlimited). */
  maxEvalCells?: number;
};

function viewportPolygon(bounds: ViewportBounds): Polygon {
  const { west, south, east, north } = bounds;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

/** H3 cells covering a viewport bounds polygon. */
export function h3CellsForViewportBounds(
  bounds: ViewportBounds,
  options: H3CellsForViewportOptions
): string[] {
  const { resolution, centerLat, centerLng, fallbackDiskK = 1, maxEvalCells } = options;

  try {
    const tessellated = polygonToH3(viewportPolygon(bounds), resolution);
    if (maxEvalCells !== undefined && tessellated.length > maxEvalCells) return [];
    if (tessellated.length > 0) return tessellated;
  } catch {
    /* fall through */
  }

  const lat = centerLat ?? (bounds.south + bounds.north) / 2;
  const lng = centerLng ?? (bounds.west + bounds.east) / 2;

  try {
    const center = latLngToCell(lat, lng, resolution);
    return gridDisk(center, fallbackDiskK);
  } catch {
    return [];
  }
}

function cellDistanceSq(cell: string, lat: number, lng: number): number {
  const [clat, clng] = h3ToCoordinates(expandH3CellId(cell));
  const dlat = clat - lat;
  const dlng = clng - lng;
  return dlat * dlat + dlng * dlng;
}

/** Keep the nearest cells to a map center when tessellation exceeds a draw budget. */
export function prioritizeH3CellsNearCenter(
  cells: string[],
  lat: number,
  lng: number,
  limit: number
): string[] {
  if (cells.length <= limit) return cells;
  return [...cells]
    .sort((a, b) => cellDistanceSq(a, lat, lng) - cellDistanceSq(b, lat, lng))
    .slice(0, limit);
}

export type ViewportH3PrioritizeOptions = {
  bounds: ViewportBounds;
  centerLat: number;
  centerLng: number;
  limit: number;
};

/** Pin viewport corners first, then fill toward center — keeps edge cell shards under a cap. */
export function prioritizeH3CellsForViewport(
  cells: string[],
  options: ViewportH3PrioritizeOptions
): string[] {
  if (cells.length <= options.limit) return cells;

  const corners: [number, number][] = [
    [options.bounds.north, options.bounds.west],
    [options.bounds.north, options.bounds.east],
    [options.bounds.south, options.bounds.east],
    [options.bounds.south, options.bounds.west],
  ];

  const picked = new Set<string>();

  for (const [lat, lng] of corners) {
    if (picked.size >= options.limit) break;
    let best: string | null = null;
    let bestDist = Infinity;
    for (const cell of cells) {
      if (picked.has(cell)) continue;
      const dist = cellDistanceSq(cell, lat, lng);
      if (dist < bestDist) {
        bestDist = dist;
        best = cell;
      }
    }
    if (best) picked.add(best);
  }

  const remaining = cells
    .filter((cell) => !picked.has(cell))
    .sort(
      (a, b) =>
        cellDistanceSq(a, options.centerLat, options.centerLng) -
        cellDistanceSq(b, options.centerLat, options.centerLng)
    );

  for (const cell of remaining) {
    if (picked.size >= options.limit) break;
    picked.add(cell);
  }

  return [...picked];
}

/** H3 cell(s) under a map point. */
export function h3CellsAtPoint(lat: number, lng: number, resolution: number, diskK = 0): string[] {
  try {
    const center = latLngToCell(lat, lng, resolution);
    if (diskK <= 0) return [center];
    return gridDisk(center, diskK);
  } catch {
    return [];
  }
}

export type H3GridFeatureOptions = {
  resolution?: number;
  getLoadedAt?: (cellId: string) => number | undefined;
  fillLevels: { new: number; base: number };
  lineLevels: { new: number; base: number };
  nowMs?: number;
  extraProperties?: Record<string, unknown>;
};

/** Build a GeoJSON FeatureCollection of H3 hex polygons with fade opacity properties. */
export function h3GridFeatureCollection(
  cells: Iterable<string>,
  options: H3GridFeatureOptions
): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = [];
  const nowMs = options.nowMs ?? Date.now();
  const fadeOptions = {
    getLoadedAt: options.getLoadedAt,
    normalizeCellId: compactH3CellId,
    nowMs,
  };

  for (const cell of cells) {
    const id = compactH3CellId(cell);
    if (!id) continue;
    const geometry = h3ToPolygon(expandH3CellId(id));
    if (!geometry) continue;
    const fade = h3CellFadeProperties(id, options.fillLevels, options.lineLevels, fadeOptions);
    features.push({
      type: 'Feature',
      properties: {
        h3: id,
        ...(options.resolution !== undefined ? { res: options.resolution } : {}),
        fillOpacity: fade.fillOpacity,
        lineOpacity: fade.lineOpacity,
        ...options.extraProperties,
      },
      geometry,
    });
  }
  return { type: 'FeatureCollection', features };
}
