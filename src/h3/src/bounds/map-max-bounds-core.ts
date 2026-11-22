import { expandH3CellId } from '../cell/cell-id';
import { h3GetResolution, validateH3 } from '../geometry/core';
import { h3ToBoundary } from '../geometry/boundary';
import { h3ToParent } from '../geometry/hierarchy';

import {
  MAP_MAX_BOUNDS_BBOX_PAD_FRACTION,
  MAP_MAX_BOUNDS_MIN_PAD_DEGREES,
  padLngLatBounds,
  type LngLatBounds,
} from './pad-lng-lat-bounds';

export {
  MAP_MAX_BOUNDS_BBOX_PAD_FRACTION,
  MAP_MAX_BOUNDS_MIN_PAD_DEGREES,
  padLngLatBounds,
  type LngLatBounds,
};

export type { LngLatBounds as MapMaxBounds };

/** Parent steps beyond a scope cell — loose pan region around the scope hex. */
export const MAP_MAX_BOUNDS_COARSEN_STEPS = 5;

/** H3 cell used for `setMaxBounds` — coarser than a stored geo-scope cell. */
export function h3CellForMapMaxBounds(h3Cell: string): string {
  const trimmed = h3Cell.trim();
  const expanded = expandH3CellId(trimmed);
  if (!trimmed || !validateH3(expanded)) {
    throw new Error(`invalid h3 cell: ${h3Cell}`);
  }
  const resolution = h3GetResolution(expanded);
  const target = Math.max(0, resolution - MAP_MAX_BOUNDS_COARSEN_STEPS);
  if (target === resolution) return expanded;
  return h3ToParent(expanded, target);
}

function boundsFromH3Ring(h3Cell: string): LngLatBounds {
  const ring = h3ToBoundary(h3Cell);
  if (ring.length === 0) {
    throw new Error(`invalid h3 cell: ${h3Cell}`);
  }

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lat, lng] of ring) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }

  return [west, south, east, north];
}

/** Bbox of the coarsened lock H3 cell — no padding (tests / comparisons). */
export function rawMaxBoundsFromH3Cell(h3Cell: string): LngLatBounds {
  return boundsFromH3Ring(h3CellForMapMaxBounds(h3Cell));
}

/** Padded axis-aligned bounds for MapLibre `setMaxBounds`. */
export function maxBoundsFromH3Cell(h3Cell: string): LngLatBounds {
  return padLngLatBounds(rawMaxBoundsFromH3Cell(h3Cell));
}

function assertValidH3Cell(h3Cell: string): string {
  const trimmed = h3Cell.trim();
  const expanded = expandH3CellId(trimmed);
  if (!trimmed || !validateH3(expanded)) {
    throw new Error(`invalid h3 cell: ${h3Cell}`);
  }
  return expanded;
}

/** Bbox of an explicit pan-lock H3 cell — no coarsening (use with {@link mapCameraScopeH3Cells}). */
export function rawMaxBoundsFromPanLockH3Cell(panLockCell: string): LngLatBounds {
  return boundsFromH3Ring(assertValidH3Cell(panLockCell));
}

/** Padded bounds for an explicit pan-lock H3 cell. */
export function maxBoundsFromPanLockH3Cell(panLockCell: string): LngLatBounds {
  return padLngLatBounds(rawMaxBoundsFromPanLockH3Cell(panLockCell));
}