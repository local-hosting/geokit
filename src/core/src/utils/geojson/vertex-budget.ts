/**
 * MapLibre-oriented vertex budget checks for Globe CDN boundary shapes.
 */

import { polygon as turfPolygon } from '../turf/deps';
import { simplifyTurf } from '../turf/deps';
import type { MultiPolygon, Polygon, Position } from '../../types';

/** MapLibre fill/line bucket practical limit per ring segment. */
export const MAPLIBRE_RING_VERTEX_BUDGET = 65535;

/** Per-state outer ring cap — keeps national all-states line tiles under segment budget. */
export const STATE_OUTLINE_MAX_RING_POINTS = 900;

/** Single dissolved national outline — one ring for country browse preview. */
export const COUNTRY_OUTLINE_MAX_RING_POINTS = 1200;

/** Longest allowed map segment after capping (~13 km at mid-latitudes). */
export const STATE_OUTLINE_MAX_SEGMENT_DEG = 0.12;

function isCoordinatePair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  );
}

function ringVertexCount(ring: unknown): number {
  if (!Array.isArray(ring)) return 0;
  return ring.filter(isCoordinatePair).length;
}

/** Largest ring vertex count in a Polygon or MultiPolygon. */
export function maxRingVertexCount(geometry: Polygon | MultiPolygon): number {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.reduce(
      (max, ring) => Math.max(max, ringVertexCount(ring)),
      0
    );
  }

  return geometry.coordinates.reduce((max, polygon) => {
    const polygonMax = polygon.reduce(
      (innerMax, ring) => Math.max(innerMax, ringVertexCount(ring)),
      0
    );
    return Math.max(max, polygonMax);
  }, 0);
}

export function assertRingVertexBudget(
  geometry: Polygon | MultiPolygon,
  label: string,
  budget = MAPLIBRE_RING_VERTEX_BUDGET
): string | null {
  const count = maxRingVertexCount(geometry);
  if (count <= budget) return null;
  return `${label} ring exceeds MapLibre vertex budget (${count.toLocaleString()} > ${budget.toLocaleString()})`;
}

function segmentsIntersect(a: Position, b: Position, c: Position, d: Position): boolean {
  const cross = (p: Position, q: Position, r: Position) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = cross(a, b, c);
  const d2 = cross(a, b, d);
  const d3 = cross(c, d, a);
  const d4 = cross(c, d, b);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/** Count non-adjacent segment crossings in a ring (0 = safe for fill + line render). */
export function ringSelfIntersectionCount(ring: Position[]): number {
  const isClosed =
    ring.length > 1 &&
    ring[0]?.[0] === ring[ring.length - 1]?.[0] &&
    ring[0]?.[1] === ring[ring.length - 1]?.[1];
  const open = isClosed ? ring.slice(0, -1) : [...ring];
  if (open.length < 4) return 0;

  let count = 0;
  for (let i = 0; i < open.length; i += 1) {
    const a = open[i]!;
    const b = open[(i + 1) % open.length]!;
    for (let j = i + 2; j < open.length; j += 1) {
      if (j === open.length - 1 && i === 0) continue;
      const c = open[j]!;
      const d = open[(j + 1) % open.length]!;
      if (segmentsIntersect(a, b, c, d)) count += 1;
    }
  }
  return count;
}

function toOpenRing(ring: Position[]): Position[] {
  if (ring.length < 2) return [...ring];
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) return ring.slice(0, -1);
  return [...ring];
}

function closeRing(open: Position[]): Position[] {
  if (open.length === 0) return open;
  const first = open[0]!;
  const last = open[open.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) return open;
  return [...open, first];
}

function segmentLengthDeg(a: Position, b: Position): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Longest edge in a ring (degrees). */
export function maxRingSegmentLengthDeg(ring: Position[]): number {
  if (ring.length < 2) return 0;
  let max = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    max = Math.max(max, segmentLengthDeg(ring[i]!, ring[i + 1]!));
  }
  return max;
}

function nearestIndex(open: Position[], point: Position, hint = 0): number {
  let best = hint % open.length;
  let bestDist = Infinity;
  for (let offset = 0; offset < open.length; offset += 1) {
    for (const delta of offset === 0 ? [0] : [offset, -offset]) {
      const index = (hint + delta + open.length) % open.length;
      const candidate = open[index]!;
      const dist = Math.hypot(candidate[0] - point[0], candidate[1] - point[1]);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    }
    if (bestDist < 1e-9) break;
  }
  return best;
}

function walkRingPath(open: Position[], from: number, to: number): Position[] {
  if (from === to) return [open[from]!];
  const forward: Position[] = [open[from]!];
  let index = from;
  while (index !== to) {
    index = (index + 1) % open.length;
    forward.push(open[index]!);
  }

  const backward: Position[] = [open[from]!];
  index = from;
  while (index !== to) {
    index = (index - 1 + open.length) % open.length;
    backward.push(open[index]!);
  }

  return forward.length <= backward.length ? forward : backward;
}

function simplifyGeoJsonRing(ring: Position[], tolerance: number): Position[] {
  const openRing = toOpenRing(ring);
  if (openRing.length < 3) return ring;

  const simplified = simplifyTurf(turfPolygon([[...openRing, openRing[0]!]]), {
    tolerance,
    highQuality: true,
  });
  if (simplified.geometry.type !== 'Polygon') return ring;

  const out = simplified.geometry.coordinates[0];
  if (!out?.length) return ring;
  return closeRing(out.slice(0, -1));
}

function longestEdgeIndex(open: Position[]): number {
  let maxLen = 0;
  let maxIndex = 0;
  for (let i = 0; i < open.length; i += 1) {
    const len = segmentLengthDeg(open[i]!, open[(i + 1) % open.length]!);
    if (len > maxLen) {
      maxLen = len;
      maxIndex = i;
    }
  }
  return maxIndex;
}

/** Walk the reference ring to replace long simplify chords with real border detail. */
function refineLongSegments(
  simplified: Position[],
  reference: Position[],
  maxPoints: number,
  maxSegmentDeg: number
): Position[] {
  const referenceOpen = toOpenRing(reference);
  let open = toOpenRing(simplified);

  for (let pass = 0; pass < 24; pass += 1) {
    if (maxRingSegmentLengthDeg(closeRing(open)) <= maxSegmentDeg) break;

    const edgeIndex = longestEdgeIndex(open);
    const cur = open[edgeIndex]!;
    const next = open[(edgeIndex + 1) % open.length]!;
    if (segmentLengthDeg(cur, next) <= maxSegmentDeg) break;

    const path = walkRingPath(
      referenceOpen,
      nearestIndex(referenceOpen, cur),
      nearestIndex(referenceOpen, next)
    ).slice(1, -1);
    if (path.length === 0) break;

    const budget = maxPoints - 1 - open.length;
    if (budget <= 0) break;

    const insert =
      path.length <= budget
        ? path
        : Array.from({ length: budget }, (_, index) => {
            const pathIndex = Math.min(
              path.length - 1,
              Math.floor((index * path.length) / budget)
            );
            return path[pathIndex]!;
          });

    open.splice(edgeIndex + 1, 0, ...insert);
  }

  return closeRing(open);
}

function isAcceptableCapCandidate(
  candidate: Position[],
  reference: Position[],
  maxPoints: number,
  maxSegmentDeg: number
): boolean {
  const referenceMaxSeg = maxRingSegmentLengthDeg(reference);
  const segmentBudget = Math.min(maxSegmentDeg, referenceMaxSeg);
  return (
    candidate.length <= maxPoints &&
    maxRingSegmentLengthDeg(candidate) <= segmentBudget
  );
}


function withoutSelfIntersection(
  ring: Position[],
  pointBudget: number,
  startTolerance: number
): Position[] | null {
  for (let tolerance = startTolerance; tolerance <= 8; tolerance *= 1.08) {
    const candidate = simplifyGeoJsonRing(ring, tolerance);
    if (candidate.length <= pointBudget && ringSelfIntersectionCount(candidate) === 0) {
      return candidate;
    }
  }
  return null;
}

function capScore(candidate: Position[]): number {
  return maxRingSegmentLengthDeg(candidate) * 10_000 + candidate.length;
}

function findToleranceForPointBudget(ring: Position[], pointBudget: number): number {
  if (ring.length <= pointBudget) return 0;

  let lo = 0;
  let hi = 2;
  let best = 2;

  for (let i = 0; i < 24; i += 1) {
    const tolerance = (lo + hi) / 2;
    const candidate = simplifyGeoJsonRing(ring, tolerance);
    if (candidate.length <= pointBudget) {
      best = tolerance;
      hi = tolerance;
    } else {
      lo = tolerance;
    }
  }

  return best;
}

/**
 * Simplify a GeoJSON ring to maxPoints using Douglas–Peucker (never index decimation).
 * Never returns rings above MapLibre's line-bucket vertex limit; prefers refine over chords.
 */
export function capGeoJsonRingToMaxPoints(
  ring: Position[],
  maxPoints: number,
  maxSegmentDeg = STATE_OUTLINE_MAX_SEGMENT_DEG
): Position[] {
  const pointBudget = Math.min(maxPoints, MAPLIBRE_RING_VERTEX_BUDGET - 1);
  if (ring.length <= pointBudget && ringSelfIntersectionCount(ring) === 0) return ring;
  if (isAcceptableCapCandidate(ring, ring, pointBudget, maxSegmentDeg)) return ring;

  const segmentTarget = Math.min(maxSegmentDeg, maxRingSegmentLengthDeg(ring));
  const tolerance = findToleranceForPointBudget(ring, pointBudget);
  let candidate = refineLongSegments(
    simplifyGeoJsonRing(ring, tolerance),
    ring,
    pointBudget,
    segmentTarget
  );

  if (
    candidate.length <= pointBudget &&
    ringSelfIntersectionCount(candidate) === 0 &&
    isAcceptableCapCandidate(candidate, ring, pointBudget, maxSegmentDeg)
  ) {
    return candidate;
  }

  if (candidate.length <= pointBudget && ringSelfIntersectionCount(candidate) === 0) {
    return candidate;
  }

  const fallback = simplifyGeoJsonRing(ring, tolerance);
  if (fallback.length <= pointBudget && ringSelfIntersectionCount(fallback) === 0) {
    return fallback;
  }

  const clean = withoutSelfIntersection(ring, pointBudget, tolerance);
  if (clean) return clean;

  const oversized = candidate.length <= pointBudget ? candidate : fallback;
  if (oversized.length <= pointBudget) return oversized;

  const open = toOpenRing(ring);
  const step = Math.max(1, Math.ceil(open.length / Math.max(2, pointBudget - 1)));
  const decimated = open.filter((_, index) => index % step === 0);
  return closeRing(decimated.length >= 3 ? decimated : open.slice(0, Math.max(2, pointBudget - 1)));
}
