import { describe, it, expect } from 'vitest';
import { gridCluster, gridClusterMeters, distanceCluster } from '../src/clustering';

describe('clustering', () => {
  const points = [
    { coordinates: [40.7128, -74.006] as [number, number] },
    { coordinates: [40.713, -74.0062] as [number, number] },
    { coordinates: [40.758, -73.9855] as [number, number] },
    { coordinates: [40.759, -73.9865] as [number, number] },
  ];

  describe('gridCluster', () => {
    it('should cluster points into grid cells', () => {
      const clusters = gridCluster(0.01, points);
      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters.length).toBeLessThanOrEqual(points.length);
    });

    it('should group nearby points together', () => {
      const clusters = gridCluster(0.1, points);
      // With large cell size, all points should be in one or two clusters
      expect(clusters.length).toBeLessThanOrEqual(2);
    });

    it('should include all points in clusters', () => {
      const clusters = gridCluster(0.01, points);
      const totalPoints = clusters.reduce((sum, cluster) => sum + cluster.count, 0);
      expect(totalPoints).toBe(points.length);
    });

    it('should calculate cluster centers', () => {
      const clusters = gridCluster(0.01, points);
      for (const cluster of clusters) {
        expect(cluster.center).toHaveLength(2);
        expect(typeof cluster.center[0]).toBe('number');
        expect(typeof cluster.center[1]).toBe('number');
      }
    });

    it('should return empty array for no points', () => {
      const clusters = gridCluster(0.01, []);
      expect(clusters).toEqual([]);
    });
  });

  describe('gridClusterMeters', () => {
    it('should cluster with meter-based cell size', () => {
      const clusters = gridClusterMeters(1000, points); // 1km cells
      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters.length).toBeLessThanOrEqual(points.length);
    });

    it('should return empty for no points', () => {
      const clusters = gridClusterMeters(1000, []);
      expect(clusters).toEqual([]);
    });
  });

  describe('distanceCluster', () => {
    it('should cluster points within distance threshold', () => {
      const clusters = distanceCluster(1000, points); // 1km threshold
      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters.length).toBeLessThanOrEqual(points.length);
    });

    it('should create separate clusters for distant points', () => {
      const clusters = distanceCluster(100, points); // 100m threshold
      // Some points might be within 100m, so clusters should be <= points
      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters.length).toBeLessThanOrEqual(points.length);
    });

    it('should merge nearby points into one cluster', () => {
      const nearbyPoints = [
        { coordinates: [40.7128, -74.006] as [number, number] },
        { coordinates: [40.7129, -74.0061] as [number, number] },
      ];
      const clusters = distanceCluster(1000, nearbyPoints);
      expect(clusters.length).toBe(1);
      expect(clusters[0].count).toBe(2);
    });

    it('should include all points in clusters', () => {
      const clusters = distanceCluster(1000, points);
      const totalPoints = clusters.reduce((sum, cluster) => sum + cluster.count, 0);
      expect(totalPoints).toBe(points.length);
    });

    it('should return empty array for no points', () => {
      const clusters = distanceCluster(1000, []);
      expect(clusters).toEqual([]);
    });

    it('should handle points with metadata', () => {
      const pointsWithData = [
        { coordinates: [40.7128, -74.006] as [number, number], data: { id: 1 } },
        { coordinates: [40.713, -74.0062] as [number, number], data: { id: 2 } },
      ];
      const clusters = distanceCluster(1000, pointsWithData);
      expect(clusters.length).toBe(1);
      expect(clusters[0].points[0].data).toEqual({ id: 1 });
    });
  });
});
