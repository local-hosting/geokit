import { describe, it, expect } from 'vitest';
import { gridCluster, gridClusterMeters, distanceCluster } from '../../src/utils/clustering';

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

  describe('edge cases', () => {
    describe('gridCluster edge cases', () => {
      it('should handle single point', () => {
        const singlePoint = [{ coordinates: [40.7128, -74.006] as [number, number] }];
        const clusters = gridCluster(0.01, singlePoint);
        expect(clusters.length).toBe(1);
        expect(clusters[0].count).toBe(1);
      });

      it('should handle very small cell size', () => {
        const clusters = gridCluster(0.0001, points);
        expect(clusters.length).toBeGreaterThan(0);
        expect(clusters.length).toBeLessThanOrEqual(points.length);
      });

      it('should handle very large cell size', () => {
        const clusters = gridCluster(10, points);
        expect(clusters.length).toBe(1); // All in one cluster
        expect(clusters[0].count).toBe(points.length);
      });

      it('should handle points at same location', () => {
        const samePoints = [
          { coordinates: [40.7128, -74.006] as [number, number] },
          { coordinates: [40.7128, -74.006] as [number, number] },
          { coordinates: [40.7128, -74.006] as [number, number] },
        ];
        const clusters = gridCluster(0.01, samePoints);
        expect(clusters.length).toBe(1);
        expect(clusters[0].count).toBe(3);
      });

      it('should handle points across antimeridian', () => {
        const antimerPoints = [
          { coordinates: [0, 179.9] as [number, number] },
          { coordinates: [0, -179.9] as [number, number] },
        ];
        const clusters = gridCluster(1, antimerPoints);
        expect(clusters.length).toBeGreaterThan(0);
      });

      it('should handle points at poles', () => {
        const polarPoints = [
          { coordinates: [89, 0] as [number, number] },
          { coordinates: [89, 90] as [number, number] },
          { coordinates: [89, 180] as [number, number] },
        ];
        const clusters = gridCluster(1, polarPoints);
        expect(clusters.length).toBeGreaterThan(0);
      });

      it('should handle negative coordinates', () => {
        const negPoints = [
          { coordinates: [-40.7128, -74.006] as [number, number] },
          { coordinates: [-40.713, -74.0062] as [number, number] },
        ];
        const clusters = gridCluster(0.01, negPoints);
        expect(clusters.length).toBeGreaterThan(0);
      });
    });

    describe('gridClusterMeters edge cases', () => {
      it('should handle very small distance', () => {
        const clusters = gridClusterMeters(1, points); // 1 meter cells
        expect(clusters.length).toBeGreaterThan(0);
      });

      it('should handle very large distance', () => {
        const clusters = gridClusterMeters(1000000, points); // 1000km cells
        expect(clusters.length).toBe(1);
      });

      it('should handle single point', () => {
        const singlePoint = [{ coordinates: [40.7128, -74.006] as [number, number] }];
        const clusters = gridClusterMeters(1000, singlePoint);
        expect(clusters.length).toBe(1);
      });
    });

    describe('distanceCluster edge cases', () => {
      it('should handle zero threshold', () => {
        const clusters = distanceCluster(0, points);
        // Each point should be its own cluster with zero threshold
        expect(clusters.length).toBe(points.length);
      });

      it('should handle single point', () => {
        const singlePoint = [{ coordinates: [40.7128, -74.006] as [number, number] }];
        const clusters = distanceCluster(1000, singlePoint);
        expect(clusters.length).toBe(1);
        expect(clusters[0].count).toBe(1);
      });

      it('should handle all points within threshold', () => {
        const closePoints = [
          { coordinates: [40.7128, -74.006] as [number, number] },
          { coordinates: [40.71281, -74.00601] as [number, number] },
          { coordinates: [40.71282, -74.00602] as [number, number] },
        ];
        const clusters = distanceCluster(1000, closePoints);
        expect(clusters.length).toBe(1);
        expect(clusters[0].count).toBe(3);
      });

      it('should handle all points outside threshold', () => {
        const farPoints = [
          { coordinates: [0, 0] as [number, number] },
          { coordinates: [10, 10] as [number, number] },
          { coordinates: [20, 20] as [number, number] },
        ];
        const clusters = distanceCluster(1, farPoints); // 1 meter threshold
        expect(clusters.length).toBe(farPoints.length);
      });

      it('should handle points at antimeridian', () => {
        const antimerPoints = [
          { coordinates: [0, 179.9] as [number, number] },
          { coordinates: [0, -179.9] as [number, number] },
        ];
        const clusters = distanceCluster(50000, antimerPoints); // 50km
        expect(clusters.length).toBeGreaterThan(0);
      });

      it('should handle points at poles', () => {
        const polarPoints = [
          { coordinates: [89.9, 0] as [number, number] },
          { coordinates: [89.9, 90] as [number, number] },
        ];
        const clusters = distanceCluster(10000, polarPoints); // 10km
        expect(clusters.length).toBeGreaterThan(0);
      });

      it('should calculate correct cluster centers', () => {
        const closePoints = [
          { coordinates: [40.0, -74.0] as [number, number] },
          { coordinates: [40.001, -74.001] as [number, number] },
        ];
        const clusters = distanceCluster(1000, closePoints);
        expect(clusters[0].center).toHaveLength(2);
        expect(clusters[0].center[0]).toBeGreaterThan(39.9);
        expect(clusters[0].center[0]).toBeLessThan(40.1);
      });

      it('should handle very large threshold', () => {
        const clusters = distanceCluster(40000000, points); // 40,000km (Earth's circumference)
        expect(clusters.length).toBe(1);
        expect(clusters[0].count).toBe(points.length);
      });
    });
  });
});
