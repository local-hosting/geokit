/**
 * Andrew's monotone chain convex hull on [lon, lat] coordinates — no Turf/concaveman (CJS under Vite).
 */
function cross(
  origin: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  return (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);
}

function dedupeSorted(points: [number, number][]): [number, number][] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length === 0) return sorted;
  const out: [number, number][] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i += 1) {
    const p = sorted[i]!;
    const last = out[out.length - 1]!;
    if (p[0] !== last[0] || p[1] !== last[1]) out.push(p);
  }
  return out;
}

/** Closed ring [lon, lat] with ≥ 4 vertices, or null when hull is degenerate. */
export function monotoneChainConvexHullLonLat(points: [number, number][]): [number, number][] | null {
  const pts = dedupeSorted(points);
  if (pts.length < 3) return null;

  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  const hull = lower.concat(upper);
  if (hull.length < 3) return null;

  const ring = [...hull, hull[0]!];
  return ring;
}