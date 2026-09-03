import { bufferPoint } from '../buffer/buffer-point';
import { estimateTravelRadiusMiles } from './travel-radius';
import type { Polygon } from 'geojson';

/** Radius or travel-time reach around a point (circular buffer). */
export type ReachSpec =
  | { kind: 'radius'; miles: number }
  | { kind: 'travel'; mode: string; minutes: number };

const METERS_PER_MILE = 1609.344;
const DEFAULT_BUFFER_STEPS = 32;

/**
 * Build a circular reach polygon from a point and radius or travel-time estimate.
 */
export function reachPolygon(
  lat: number,
  lon: number,
  spec: ReachSpec,
  options?: { steps?: number },
): Polygon {
  const miles =
    spec.kind === 'radius'
      ? spec.miles
      : estimateTravelRadiusMiles(spec.minutes, spec.mode);
  const meters = miles * METERS_PER_MILE;
  const steps = options?.steps ?? DEFAULT_BUFFER_STEPS;
  const buffered = bufferPoint([lat, lon], meters, steps);
  if (buffered.type !== 'Polygon') {
    throw new Error(`reachPolygon: expected Polygon, got ${buffered.type}`);
  }
  return buffered;
}
