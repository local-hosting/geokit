import type { LatLon } from '../../types';
import { METERS_PER_DEGREE_EQUATOR, DEGREES_TO_RADIANS } from '../../constants';

/**
 * Cluster point with metadata
 */
export interface ClusterPoint<T = unknown> {
  coordinates: LatLon;
  data?: T;
}

/**
 * Cluster result
 */
export interface Cluster<T = unknown> {
  center: LatLon;
  points: ClusterPoint<T>[];
  count: number;
}

/**
 * Grid-based clustering (curried)
 * Groups points into grid cells of specified size
 *
 * @param cellSize - Grid cell size in degrees
 * @returns Curried function that takes points and returns clusters
 *
 * @example
 * ```typescript
 * const clusterBy001 = gridCluster(0.01);
 * const points = [
 *   { coordinates: [40.7128, -74.0060] },
 *   { coordinates: [40.7130, -74.0062] },
 *   { coordinates: [40.7580, -73.9855] }
 * ];
 * const clusters = clusterBy001(points);
 * ```
 */
export function gridCluster<T = unknown>(cellSize: number) {
  return (points: ClusterPoint<T>[]): Cluster<T>[] => {
    const grid: Map<string, ClusterPoint<T>[]> = new Map();

    // Assign points to grid cells
    for (const point of points) {
      const [lat, lon] = point.coordinates;
      const cellLat = Math.floor(lat / cellSize);
      const cellLon = Math.floor(lon / cellSize);
      const key = `${cellLat},${cellLon}`;

      if (!grid.has(key)) {
        grid.set(key, []);
      }
      grid.get(key)!.push(point);
    }

    // Convert grid cells to clusters
    const clusters: Cluster<T>[] = [];

    for (const [, cellPoints] of grid) {
      // Calculate center as average of points
      const sumLat = cellPoints.reduce((sum, p) => sum + p.coordinates[0], 0);
      const sumLon = cellPoints.reduce((sum, p) => sum + p.coordinates[1], 0);
      const center: LatLon = [sumLat / cellPoints.length, sumLon / cellPoints.length];

      clusters.push({
        center,
        points: cellPoints,
        count: cellPoints.length,
      });
    }

    return clusters;
  };
}

/**
 * Grid-based clustering with cell size in meters (curried)
 *
 * @param cellSizeMeters - Grid cell size in meters
 * @returns Curried function that takes points and returns clusters
 *
 * @example
 * ```typescript
 * const clusterByKm = gridClusterMeters(1000);
 * const clusters = clusterByKm(points); // 1km cells
 * ```
 */
export function gridClusterMeters<T = unknown>(cellSizeMeters: number) {
  return (points: ClusterPoint<T>[]): Cluster<T>[] => {
    if (points.length === 0) {
      return [];
    }

    // Use average latitude to convert meters to degrees
    const avgLat = points.reduce((sum, point) => sum + point.coordinates[0], 0) / points.length;
    const metersPerDegree = METERS_PER_DEGREE_EQUATOR * Math.cos(avgLat * DEGREES_TO_RADIANS);
    const cellSizeDegrees = cellSizeMeters / metersPerDegree;

    return gridCluster<T>(cellSizeDegrees)(points);
  };
}
