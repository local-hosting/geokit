import { describe, expect, it } from 'vitest';
import {
  approximateViewportBoundsFromCenterZoom,
  mapViewportBounds,
} from '@local-hosting/geokit/h3';

describe('h3 map-viewport', () => {
  describe('approximateViewportBoundsFromCenterZoom', () => {
    it('returns bounds centered on the given lat/lng', () => {
      const bounds = approximateViewportBoundsFromCenterZoom(40.7, -74.0, 10);
      expect(bounds.west).toBeLessThan(-74.0);
      expect(bounds.east).toBeGreaterThan(-74.0);
      expect(bounds.south).toBeLessThan(40.7);
      expect(bounds.north).toBeGreaterThan(40.7);
    });

    it('narrows bounds at higher zoom levels', () => {
      const zoom10 = approximateViewportBoundsFromCenterZoom(40.7, -74.0, 10);
      const zoom12 = approximateViewportBoundsFromCenterZoom(40.7, -74.0, 12);
      const span10 = zoom10.east - zoom10.west;
      const span12 = zoom12.east - zoom12.west;
      expect(span12).toBeLessThan(span10);
    });
  });

  describe('mapViewportBounds', () => {
    it('reads bounds and center from a map-like object', () => {
      const viewport = mapViewportBounds({
        getBounds: () => ({
          getWest: () => -74.1,
          getSouth: () => 40.6,
          getEast: () => -73.9,
          getNorth: () => 40.8,
        }),
        getCenter: () => ({ lat: 40.7, lng: -74.0 }),
      });
      expect(viewport).toEqual({
        bounds: { west: -74.1, south: 40.6, east: -73.9, north: 40.8 },
        centerLat: 40.7,
        centerLng: -74.0,
      });
    });

    it('returns null when map APIs are missing', () => {
      expect(mapViewportBounds({})).toBeNull();
    });
  });
});
