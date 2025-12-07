import type { LatLon } from '../../types';
import type { ClusterPoint, Cluster } from './grid';
import { EARTH_RADIUS_METERS, DEGREES_TO_RADIANS } from '../../constants';

/**
 * Distance-based clustering using a simple greedy algorithm
 * Groups points that are within threshold distance of each other
 *
 * @param threshold - Maximum distance between points in same cluster (in meters)
 * @param points - Array of points to cluster
 * @returns Array of clusters
 *
 * @example
 * ```typescript
 * const points = [
 *   { coordinates: [40.7128, -74.0060] },
 *   { coordinates: [40.7130, -74.0062] },
 *   { coordinates: [40.7580, -73.9855] }
 * ];
 * const clusters = distanceCluster(1000, points); // 1km threshold
 * ```
 */
export function distanceCluster<T = unknown>(
  threshold: number,
  points: ClusterPoint<T>[]
): Cluster<T>[] {
  if (points.length === 0) {
    return [];
  }

  const clusters: Cluster<T>[] = [];
  const assigned = new Set<number>();

  // Helper: calculate distance using Haversine
  function distance(point1: LatLon, point2: LatLon): number {
    const [lat1, lon1] = point1;
    const [lat2, lon2] = point2;

    const dLat = (lat2 - lat1) * DEGREES_TO_RADIANS;
    const dLon = (lon2 - lon1) * DEGREES_TO_RADIANS;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * DEGREES_TO_RADIANS) *
        Math.cos(lat2 * DEGREES_TO_RADIANS) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_METERS * c;
  }

  // Greedy clustering
  for (let i = 0; i < points.length; i++) {
    if (assigned.has(i)) {
      continue;
    }

    const clusterPoints: ClusterPoint<T>[] = [points[i]];
    assigned.add(i);

    // Find all points within threshold
    for (let j = i + 1; j < points.length; j++) {
      if (assigned.has(j)) {
        continue;
      }

      const dist = distance(points[i].coordinates, points[j].coordinates);
      if (dist <= threshold) {
        clusterPoints.push(points[j]);
        assigned.add(j);
      }
    }

    // Calculate cluster center
    const sumLat = clusterPoints.reduce((sum, p) => sum + p.coordinates[0], 0);
    const sumLon = clusterPoints.reduce((sum, p) => sum + p.coordinates[1], 0);
    const center: LatLon = [sumLat / clusterPoints.length, sumLon / clusterPoints.length];

    clusters.push({
      center,
      points: clusterPoints,
      count: clusterPoints.length,
    });
  }

  return clusters;
}
