import { describe, expect, it } from 'vitest';
import { generateGeodesicCirclePolygon } from '../../../src/utils/geodesic-circle';
import {
  CachedPointFeatureBuilder,
  normalizePointCoordinates,
} from '../../../src/utils/shared-point-features';
import {
  annotatePointFeaturesStrokeFromFill,
  literalNumberFromPaintExpression,
  paintColorFromProperty,
  sharedPointOuterStrokeLayerId,
  sharedPointRadiusByPropertyExpression,
  sharedPointRadiusPlusStrokeWidth,
  sharedPointStrokeFromFillColorExpression,
  sharedPointStrokeFromFillWidthExpression,
} from '../../../src/utils/shared-point-paint';

/** Stand-in for Trustbase identity `blendHexWithBlack(hex, 0.45)`. */
function darkenTowardBlack(hex: string, blackWeight = 0.45): string {
  const clean = hex.replace('#', '');
  const mix = (channel: number) => Math.round(channel * (1 - blackWeight));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(parseInt(clean.slice(0, 2), 16)))}${toHex(
    mix(parseInt(clean.slice(2, 4), 16))
  )}${toHex(mix(parseInt(clean.slice(4, 6), 16)))}`;
}

describe('geodesic circle', () => {
  it('generates a closed ring with steps + 1 coordinates', () => {
    const ring = generateGeodesicCirclePolygon(-85.7, 38.2, 1609.34 * 30, 64);
    expect(ring).toHaveLength(65);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});

describe('normalizePointCoordinates', () => {
  it('returns null for invalid geometry', () => {
    expect(normalizePointCoordinates(null)).toBeNull();
    expect(normalizePointCoordinates({ geometry: { type: 'LineString' } })).toBeNull();
  });

  it('normalizes numeric lng/lat', () => {
    expect(
      normalizePointCoordinates({
        geometry: { type: 'Point', coordinates: ['-85.7', '38.2'] },
      })
    ).toEqual({ type: 'Point', coordinates: [-85.7, 38.2] });
  });
});

describe('shared point paint', () => {
  it('builds coalesce color expression', () => {
    expect(paintColorFromProperty('_color', '#ccc')).toEqual([
      'coalesce',
      ['get', '_color'],
      '#ccc',
    ]);
  });

  it('scales radius for non-primary brand values', () => {
    const expr = sharedPointRadiusByPropertyExpression('brand', 'acme');
    expect(expr[0]).toBe('*');
    expect(expr[2][0]).toBe('case');
  });

  it('builds stroke expressions via caller fill transform', () => {
    expect(sharedPointStrokeFromFillWidthExpression()).toEqual(['literal', 1.25]);
    expect(sharedPointStrokeFromFillColorExpression('#c3d361', darkenTowardBlack)).toEqual([
      'coalesce',
      ['get', '_stroke'],
      '#6b7435',
    ]);
  });

  it('annotates point features with transformed _stroke from fill', () => {
    const out = annotatePointFeaturesStrokeFromFill(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: { _color: '#2dbad2' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [1, 1] },
            properties: {},
          },
        ],
      },
      { fallbackFill: '#c3d361', transformFill: darkenTowardBlack }
    );
    expect(out.features[0]?.properties?._stroke).toBe('#196674');
    expect(out.features[1]?.properties?._stroke).toBe('#6b7435');
  });

  it('offsets radius by colored ring width for the outer white stroke layer', () => {
    expect(sharedPointOuterStrokeLayerId('canvas-venues-point')).toBe(
      'canvas-venues-point-outer-stroke'
    );
    expect(literalNumberFromPaintExpression(['literal', 3.5])).toBe(3.5);
    expect(sharedPointRadiusPlusStrokeWidth(4, 3.5)).toBe(7.5);
    expect(sharedPointRadiusPlusStrokeWidth(['literal', 4], 3.5)).toEqual([
      '+',
      ['literal', 4],
      3.5,
    ]);
  });
});

describe('CachedPointFeatureBuilder', () => {
  it('reuses cached features when validation passes', () => {
    const builder = new CachedPointFeatureBuilder({ maxCacheSize: 10 });
    type Item = { id: string; color: string; lng: number; lat: number };

    const first = builder.build<Item>({
      items: [{ id: 'a', color: 'red', lng: 1, lat: 2 }],
      getFeatureId: (item) => item.id,
      getGeometry: (item) => ({
        type: 'Point',
        coordinates: [item.lng, item.lat],
      }),
      getProperties: (item) => ({ _color: item.color }),
      isCacheValid: (cached, item) => cached.properties._color === item.color,
    });

    const second = builder.build<Item>({
      items: [{ id: 'a', color: 'red', lng: 1, lat: 2 }],
      getFeatureId: (item) => item.id,
      getGeometry: (item) => ({
        type: 'Point',
        coordinates: [item.lng, item.lat],
      }),
      getProperties: (item) => ({ _color: item.color }),
      isCacheValid: (cached, item) => cached.properties._color === item.color,
    });

    expect(first.features[0]).toBe(second.features[0]);
  });
});

describe('point DMA enrichment', () => {
  it('enrichWithDma adds dma when crosswalk loaded', async () => {
    const {
      clearCountyBoundaries,
      ensureUsCrosswalkLoaded,
      resetCrosswalkForTest,
      setCountyBoundaryLoader,
    } = await import('@doppler-group/geokit/crosswalk');

    const lat = 39.7684;
    const lon = -86.1581;
    const delta = 0.25;

    resetCrosswalkForTest();
    clearCountyBoundaries();
    setCountyBoundaryLoader(async () => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { fips: '18097', dmaSlug: 'indianapolis' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [lon - delta, lat - delta],
                [lon + delta, lat - delta],
                [lon + delta, lat + delta],
                [lon - delta, lat + delta],
                [lon - delta, lat - delta],
              ],
            ],
          },
        },
      ],
    }));
    await ensureUsCrosswalkLoaded();

    const builder = new CachedPointFeatureBuilder({ maxCacheSize: 10 });
    const collection = builder.build({
      items: [{ id: 'indy', lng: lon, lat }],
      getFeatureId: (item) => item.id,
      getGeometry: (item) => ({
        type: 'Point',
        coordinates: [item.lng, item.lat],
      }),
      getProperties: () => ({ _color: '#fff' }),
      enrichWithDma: true,
      finalizeProperties: (_item, props) => ({
        ...props,
        _color: String(props.dma ?? ''),
      }),
    });

    expect(collection.features[0]?.properties.dma).toBe('indianapolis');
    expect(collection.features[0]?.properties.region).toBeTruthy();
    expect(collection.features[0]?.properties._color).toBe('indianapolis');
  });
});
