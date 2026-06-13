// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { calculateCenterAndZoom } from '@twinfile/geokit/bounds';
import type { Bounds } from '@twinfile/geokit/types';
import {
  buildMapHostUrl,
  parseMapHostPoints,
  parseMapHostBounds,
  parseMapHostRegionLayer,
  serializeMapHostBounds,
} from '../../src/mcp/open-map.js';
import { mapboxStaticAdapter } from '../../src/mcp/providers/mapbox-static.js';
import { maptilerStaticAdapter } from '../../src/mcp/providers/maptiler-static.js';
import { resolveMapViewport } from '../../src/mcp/resolve-viewport.js';
import { calculateFitBoundsViewport } from '../../src/mcp/fit-bounds-viewport.js';
import { simplifyGeometryRings } from '../../src/mcp/region-path.js';
import {
  buildMapMarkdownImage,
  buildStaticAutoUrl,
  buildStaticCenterUrl,
  DEFAULT_MAP_STYLE,
} from '../../src/mcp/static-map.js';

const TEST_KEY = 'test-map-api-key';

describe('mcp static map', () => {
  describe('resolveMapViewport', () => {
    it('resolves lat/lng with default zoom', () => {
      expect(resolveMapViewport({ lat: 38.2527, lng: -85.7585 })).toEqual({
        lat: 38.2527,
        lng: -85.7585,
        zoom: 12,
      });
    });

    it('resolves bounds to fit the image frame', () => {
      const bounds = [-85.9, 38.1, -85.6, 38.4] as const;
      const expected = calculateFitBoundsViewport([...bounds], 600, 400);
      expect(resolveMapViewport({ bounds: [...bounds] }, { width: 600, height: 400 })).toEqual(
        expected
      );
    });

    it('honors explicit zoom over bounds fit', () => {
      const bounds = [-85.9, 38.1, -85.6, 38.4] as const;
      const expected = calculateCenterAndZoom([...bounds]);
      expect(resolveMapViewport({ bounds: [...bounds], zoom: 9 })).toEqual({
        lat: expected!.lat,
        lng: expected!.lng,
        zoom: 9,
      });
    });

    it('throws when viewport cannot be resolved', () => {
      expect(() => resolveMapViewport({ lat: 38 })).toThrow(/lat\/lng or bounds/);
    });
  });

  describe('buildStaticCenterUrl', () => {
    it('builds center-based static URL for maptiler adapter', () => {
      const url = buildStaticCenterUrl(maptilerStaticAdapter, {
        viewport: { lat: 38.2527, lng: -85.7585, zoom: 10 },
        style: 'dataviz-dark',
        dimensions: { width: 640, height: 360 },
        apiKey: TEST_KEY,
      });

      expect(url).toBe(
        'https://api.maptiler.com/maps/dataviz-dark/static/-85.7585,38.2527,10/640x360.png?key=test-map-api-key'
      );
    });

    it('builds center-based static URL for mapbox adapter', () => {
      const url = buildStaticCenterUrl(mapboxStaticAdapter, {
        viewport: { lat: 38.2527, lng: -85.7585, zoom: 10 },
        style: 'mapbox/dark-v11',
        dimensions: { width: 640, height: 360 },
        apiKey: TEST_KEY,
      });

      expect(url).toBe(
        'https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/-85.7585,38.2527,10,0,0/640x360.png?access_token=test-map-api-key'
      );
    });

    it('uses default style and dimensions', () => {
      const url = buildStaticCenterUrl(maptilerStaticAdapter, {
        viewport: { lat: 40.7, lng: -74.0, zoom: 11 },
        apiKey: TEST_KEY,
      });

      expect(url).toContain(`/maps/${DEFAULT_MAP_STYLE}/static/`);
      expect(url).toContain('/600x400.png?key=');
    });

    it('appends region path overlays without encoding lng,lat commas', () => {
      const url = buildStaticCenterUrl(maptilerStaticAdapter, {
        viewport: { lat: 40.7, lng: -74.0, zoom: 11 },
        apiKey: TEST_KEY,
        overlays: ['fill:%2338bdf850|stroke:%23ffffff|width:4|-74.0,40.7|-73.9,40.8|-74.0,40.7'],
      });

      expect(url).toContain('path=fill:%2338bdf850');
      expect(url).toContain('-74.0,40.7');
      expect(url).not.toContain('%2C');
    });

    it('builds auto-fit static URL for geography paths', () => {
      const url = buildStaticAutoUrl(maptilerStaticAdapter, {
        apiKey: TEST_KEY,
        overlays: ['fill:%23ffffff|stroke:%23ffffff|width:4|-74.0,40.7|-73.9,40.8|-74.0,40.7'],
      });

      expect(url).toContain('/static/auto/600x400.png?');
      expect(url).toContain('padding=');
      expect(url).toContain('path=fill:%23ffffff');
    });
  });

  describe('geometryToOverlays', () => {
    it('builds styled path from a polygon geometry', () => {
      const overlays = maptilerStaticAdapter.geometryToOverlays({
        type: 'Polygon',
        coordinates: [
          [
            [-74.02, 40.68],
            [-73.9, 40.68],
            [-73.9, 40.75],
            [-74.02, 40.75],
            [-74.02, 40.68],
          ],
        ],
      });

      expect(overlays).toHaveLength(1);
      expect(overlays[0]).toMatch(/^fill:%23/);
      expect(overlays[0]).toMatch(/stroke:%23/);
      expect(overlays[0]).toContain('-74.02,40.68');
      expect(overlays[0]).toContain('-73.9,40.75');
    });

    it('limits points per ring for multi-island geometries', () => {
      const rings = simplifyGeometryRings({
        type: 'MultiPolygon',
        coordinates: Array.from({ length: 10 }, (_, index) => [
          [
            [-157 + index, 21],
            [-156 + index, 21],
            [-156 + index, 22],
            [-157 + index, 22],
            [-157 + index, 21],
          ],
        ]),
      });

      expect(rings).toHaveLength(10);
      expect(Math.max(...rings.map((ring) => ring.length))).toBeLessThanOrEqual(12);
    });

    it('builds geojson overlay for mapbox adapter', () => {
      const overlays = mapboxStaticAdapter.geometryToOverlays({
        type: 'Polygon',
        coordinates: [
          [
            [-74.02, 40.68],
            [-73.9, 40.68],
            [-73.9, 40.75],
            [-74.02, 40.75],
            [-74.02, 40.68],
          ],
        ],
      });

      expect(overlays).toHaveLength(1);
      expect(overlays[0]).toMatch(/^geojson\(/);
      expect(overlays[0]).toContain('"type":"Feature"');
    });
  });

  describe('buildMapHostUrl', () => {
    it('builds interactive map host URL from viewport', () => {
      const hostUrl = buildMapHostUrl({
        hostBaseUrl: 'http://localhost:3001',
        viewport: { lat: 38.2527, lng: -85.7585, zoom: 10 },
        style: 'dataviz-dark',
        theme: 'dark',
        provider: 'maptiler',
      });

      expect(hostUrl).toBe(
        'http://localhost:3001/index.html?lat=38.2527&lng=-85.7585&zoom=10&style=dataviz-dark&theme=dark&provider=maptiler'
      );
    });

    it('includes dma slug for interactive dma layers', () => {
      const hostUrl = buildMapHostUrl({
        hostBaseUrl: 'http://localhost:3002',
        viewport: { lat: 21.3, lng: -157.8, zoom: 6 },
        dmaSlug: 'honolulu',
      });

      expect(hostUrl).toContain('dmaSlug=honolulu');
    });

    it('includes place state and slug for interactive city layers', () => {
      const hostUrl = buildMapHostUrl({
        hostBaseUrl: 'http://localhost:3002',
        viewport: { lat: 42.36, lng: -71.06, zoom: 10 },
        placeState: 'ma',
        placeSlug: 'boston',
      });

      expect(hostUrl).toContain('placeState=ma');
      expect(hostUrl).toContain('placeSlug=boston');
    });

    it('includes dma region group for interactive dma layers', () => {
      const hostUrl = buildMapHostUrl({
        hostBaseUrl: 'http://localhost:3002',
        viewport: { lat: 41.1, lng: -96.15, zoom: 6 },
        regionLayer: { dataset: 'dma', slug: 'omaha', region: 'midwest' },
      });

      expect(hostUrl).toContain('regionDataset=dma');
      expect(hostUrl).toContain('regionSlug=omaha');
      expect(hostUrl).toContain('dmaRegion=midwest');
      expect(parseMapHostRegionLayer(new URL(hostUrl).searchParams)).toEqual({
        dataset: 'dma',
        slug: 'omaha',
        region: 'midwest',
      });
    });

    it('includes regionDataset params for interactive state layers', () => {
      const hostUrl = buildMapHostUrl({
        hostBaseUrl: 'http://localhost:3002',
        viewport: { lat: 39.3, lng: -116.6, zoom: 5 },
        regionLayer: { dataset: 'state', slug: 'nv' },
      });

      expect(hostUrl).toContain('regionDataset=state');
      expect(hostUrl).toContain('regionSlug=nv');
      expect(parseMapHostRegionLayer(new URL(hostUrl).searchParams)).toEqual({
        dataset: 'state',
        slug: 'nv',
      });
    });

    it('includes bounds for interactive fit-to-shape', () => {
      const bounds = [-71.2, 42.2, -70.9, 42.4] as const;
      const hostUrl = buildMapHostUrl({
        hostBaseUrl: 'http://localhost:3002',
        viewport: { lat: 42.3, lng: -71.05, zoom: 10 },
        bounds: [...bounds],
      });

      expect(hostUrl).toContain(
        `bounds=${encodeURIComponent(serializeMapHostBounds([...bounds]))}`
      );
      expect(parseMapHostBounds(new URL(hostUrl).searchParams.get('bounds'))).toEqual([...bounds]);
    });
  });

  describe('map host bounds params', () => {
    it('round-trips bounds through serialize and parse', () => {
      const bounds: Bounds = [-71.19123, 42.22791, -70.7488, 42.40021];
      expect(parseMapHostBounds(serializeMapHostBounds(bounds))).toEqual(bounds);
    });

    it('returns null for invalid bounds strings', () => {
      expect(parseMapHostBounds('')).toBeNull();
      expect(parseMapHostBounds('1,2,3')).toBeNull();
      expect(parseMapHostBounds('a,b,c,d')).toBeNull();
    });
  });

  describe('buildMapMarkdownImage', () => {
    it('returns markdown image line for chat inline rendering', () => {
      const md = buildMapMarkdownImage({
        imageUrl: 'https://example.com/map.png',
        label: 'Louisville',
        viewport: { lat: 38.25, lng: -85.76, zoom: 10 },
      });

      expect(md).toBe('![Louisville](https://example.com/map.png)');
    });

    it('derives zillow url from listing name when points omit u', () => {
      const raw =
        'W3sibGEiOjQyLjgwNSwibG4iOi03MC44NjE3NDgsIm4iOiI3IEhhbmNvY2sgU3QsIFVuaXQgMSwgTmV3YnVyeXBvcnQsIE1BIDAxOTUwIC0gJDg3NSwwMDAgLSAzIGJkIn1d';
      const parsed = parseMapHostPoints(raw);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.url).toBe(
        'https://www.zillow.com/homes/7-Hancock-St-Unit-1-Newburyport-MA-01950_rb/'
      );
    });

    it('round-trips map host points for gk-point layers', () => {
      const points = [
        {
          lat: 42.81,
          lng: -70.87,
          id: 'a',
          name: '30 Water St · $765k',
          color: '#f97316',
          url: 'https://www.zillow.com/homes/30-Water-St-Newburyport-MA-01950_rb/',
        },
        { lat: 43.07, lng: -70.78, id: 'b', name: '115 Bluefish · $365k', color: '#3b82f6' },
      ];
      const hostUrl = buildMapHostUrl({
        hostBaseUrl: 'http://localhost:3002',
        viewport: { lat: 42.9, lng: -70.8, zoom: 8 },
        bounds: [-71.2, 42.2, -70.6, 43.2],
        points,
      });
      const params = new URL(hostUrl).searchParams;
      expect(params.get('points')).toBeTruthy();
      expect(parseMapHostPoints(params.get('points'))).toEqual(points);
    });
  });
});
