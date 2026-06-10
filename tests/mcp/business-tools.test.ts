// @vitest-environment node

import type { FeatureCollection } from 'geojson';
import { describe, it, expect } from 'vitest';
import {
  formatStraightLineDistance,
  metersToMiles,
  milesToMeters,
  markdownTable,
} from '../../src/mcp/business/format.js';
import {
  CONUS_BOUNDS,
  fallbackBoundsForQuery,
  placeFromGeocodeResult,
} from '../../src/mcp/business/resolve-place.js';
import {
  isUsCountyGeocode,
  isUsStateGeocode,
  isUsZipGeocode,
  parseUsZipHint,
} from '../../src/mcp/business/resolve-region-shape.js';
import {
  circleGeometry,
  circleOverlay,
  markerGeometry,
  markerOverlay,
} from '../../src/mcp/business/overlays.js';
import { maptilerStaticAdapter } from '../../src/mcp/providers/maptiler-static.js';

describe('business mcp helpers', () => {
  describe('format', () => {
    it('converts miles to meters', () => {
      expect(milesToMeters(1)).toBeCloseTo(1609.344, 1);
    });

    it('formats human-readable straight-line distance', () => {
      expect(formatStraightLineDistance(milesToMeters(12))).toContain('12.0 miles');
    });

    it('formats short distances in meters', () => {
      expect(metersToMiles(50)).toBe('50 m');
    });

    it('builds markdown tables', () => {
      const table = markdownTable(['A', 'B'], [['1', '2']]);
      expect(table).toContain('| A | B |');
      expect(table).toContain('| 1 | 2 |');
    });
  });

  describe('resolve-place', () => {
    it('parses geocode feature collection', () => {
      const place = placeFromGeocodeResult(
        {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-85.7585, 38.2527] },
              properties: { place_name: 'Louisville, KY' },
            },
          ],
        },
        'fallback'
      );

      expect(place).toEqual({
        lat: 38.2527,
        lng: -85.7585,
        label: 'Louisville, KY',
        scope: 'point',
      });
    });

    it('frames countries and states from geocoder bbox', () => {
      const place = placeFromGeocodeResult(
        {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-100.445882, 39.783731] },
              place_name: 'United States',
              place_type: ['country'],
              bbox: [-171.791110603, 18.91619, -66.96466, 71.3577635769],
            },
          ],
        } as unknown as FeatureCollection,
        'United States'
      );

      expect(place?.scope).toBe('region');
      expect(place?.bounds).toEqual([-171.791110603, 18.91619, -66.96466, 71.3577635769]);
    });

    it('falls back to CONUS bounds for common US aliases', () => {
      expect(fallbackBoundsForQuery('United States')).toEqual(CONUS_BOUNDS);
      expect(fallbackBoundsForQuery('USA')).toEqual(CONUS_BOUNDS);
      expect(fallbackBoundsForQuery('Austin TX')).toBeNull();
    });

    it('detects US state geocode features', () => {
      expect(
        isUsStateGeocode({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-119, 37] },
          place_type: ['region'],
          properties: { country_code: 'us', place_designation: 'state' },
        })
      ).toBe(true);
      expect(
        isUsStateGeocode({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-119, 37] },
          place_type: ['region'],
          properties: { country_code: 'us', place_designation: 'country' },
        })
      ).toBe(false);
    });

    it('detects county and zip geocode features', () => {
      expect(
        isUsCountyGeocode({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-118, 34] },
          place_type: ['county'],
          properties: { country_code: 'us', place_designation: 'county' },
        })
      ).toBe(true);
      expect(
        isUsZipGeocode({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-118, 34] },
          place_type: ['postal_code'],
          properties: { country_code: 'us' },
        })
      ).toBe(true);
      expect(parseUsZipHint('90210')).toBe('90210');
      expect(parseUsZipHint('90210, USA')).toBe('90210');
    });
  });

  describe('overlays', () => {
    const provider = {
      id: 'maptiler' as const,
      apiKey: 'test',
      adapter: maptilerStaticAdapter,
    };

    it('builds marker and circle overlays', () => {
      const marker = markerOverlay(provider, 38.25, -85.76);
      const circle = circleOverlay(provider, 38.25, -85.76, milesToMeters(5));

      expect(marker[0]).toMatch(/^fill:%23/);
      expect(circle[0]).toMatch(/^fill:%23/);
      expect(markerGeometry(38.25, -85.76).type).toBe('Polygon');
      expect(circleGeometry(38.25, -85.76, 1000).coordinates[0].length).toBeGreaterThan(8);
    });
  });
});
