import { describe, expect, it } from 'vitest';
import {
  geojsonToTopology,
  simplifyFeatureCollectionTopology,
  topoGeometriesByProperty,
  topoMerge,
} from '../../src/utils/topojson';

describe('topojson shared borders', () => {
  it('topoMerge keeps identical vertices on adjacent dissolved regions', () => {
    const sharedLon = -85;
    const westCounty = [
      [sharedLon, 35],
      [-86, 35],
      [-86, 36],
      [sharedLon, 36],
      [sharedLon, 35],
    ];
    const eastCounty = [
      [-84, 35],
      [sharedLon, 35],
      [sharedLon, 36],
      [-84, 36],
      [-84, 35],
    ];

    const features = [
      {
        type: 'Feature' as const,
        properties: { fips: '47001' },
        geometry: { type: 'Polygon' as const, coordinates: [westCounty] },
      },
      {
        type: 'Feature' as const,
        properties: { fips: '47002' },
        geometry: { type: 'Polygon' as const, coordinates: [eastCounty] },
      },
    ];

    const topology = geojsonToTopology({
      counties: { type: 'FeatureCollection', features },
    });
    const geometryByFips = topoGeometriesByProperty(topology, 'counties', features, 'fips');

    const west = topoMerge(topology, [geometryByFips.get('47001')!]);
    const east = topoMerge(topology, [geometryByFips.get('47002')!]);

    const collectVertices = (geometry: { coordinates: number[][][] }) => {
      const points: [number, number][] = [];
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          for (const [lon, lat] of ring) points.push([lon, lat]);
        }
      }
      return points;
    };

    const onSharedEdge = (points: [number, number][], lon: number) =>
      [
        ...new Set(
          points.filter(([x]) => Math.abs(x - lon) < 1e-5).map(([, lat]) => Number(lat.toFixed(5)))
        ),
      ].sort((a, b) => a - b);

    expect(onSharedEdge(collectVertices(west), sharedLon)).toEqual(
      onSharedEdge(collectVertices(east), sharedLon)
    );
  });

  it('simplifyFeatureCollectionTopology reduces vertices and keeps shared borders', () => {
    const sharedLon = -85;
    const denseEdge = (lon: number, latStart: number, latEnd: number, steps: number) => {
      const ring: [number, number][] = [];
      for (let i = 0; i <= steps; i++) {
        const lat = latStart + ((latEnd - latStart) * i) / steps;
        ring.push([lon, lat]);
      }
      return ring;
    };

    const westOuter = [...denseEdge(sharedLon, 35, 36, 40), [-86, 36], [-86, 35], [sharedLon, 35]];
    const eastOuter = [
      [-84, 35],
      ...denseEdge(sharedLon, 35, 36, 40).slice().reverse(),
      [-84, 36],
      [-84, 35],
    ];

    const collection = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { fips: '47001' },
          geometry: { type: 'Polygon' as const, coordinates: [westOuter] },
        },
        {
          type: 'Feature' as const,
          properties: { fips: '47002' },
          geometry: { type: 'Polygon' as const, coordinates: [eastOuter] },
        },
      ],
    };

    const beforeVerts = collection.features.reduce((total, feature) => {
      const ring = feature.geometry.coordinates[0];
      return total + ring.length;
    }, 0);

    const simplified = simplifyFeatureCollectionTopology(collection, 'counties', 50);
    const afterVerts = simplified.features.reduce((total, feature) => {
      const ring = feature.geometry.coordinates[0];
      return total + ring.length;
    }, 0);

    expect(afterVerts).toBeLessThan(beforeVerts);

    const topology = geojsonToTopology({ counties: simplified });
    const geometryByFips = topoGeometriesByProperty(
      topology,
      'counties',
      simplified.features,
      'fips'
    );
    const west = topoMerge(topology, [geometryByFips.get('47001')!]);
    const east = topoMerge(topology, [geometryByFips.get('47002')!]);

    const collectVertices = (geometry: { coordinates: number[][][] }) => {
      const points: [number, number][] = [];
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          for (const [lon, lat] of ring) points.push([lon, lat]);
        }
      }
      return points;
    };

    const onSharedEdge = (points: [number, number][], lon: number) =>
      [
        ...new Set(
          points.filter(([x]) => Math.abs(x - lon) < 1e-5).map(([, lat]) => Number(lat.toFixed(5)))
        ),
      ].sort((a, b) => a - b);

    expect(onSharedEdge(collectVertices(west), sharedLon)).toEqual(
      onSharedEdge(collectVertices(east), sharedLon)
    );
  });
});
