import { describe, expect, it, vi } from 'vitest';

const layerStylesMock = vi.hoisted(() => ({
  createSharedPointLayers: vi.fn(),
  ensureSharedPointSelectionRingLayer: vi.fn(),
  ensureSharedPointHoverLayers: vi.fn(),
  setupSelectionGroundBadgeLayers: vi.fn(),
  getGlowRadiusInterpolation: () => ['literal', 12],
  multiplyRadiusExpression: (base: unknown, scale: number) => ['*', base, scale],
}));

const { createSharedPointLayers } = layerStylesMock;

vi.mock('../../../src/utils/map-utils', () => ({
  updateSourceData: vi.fn(() => true),
}));

vi.mock('../../../src/utils/shared-point-heal.js', () => ({
  ensureSharedPointLayerSetHealed: vi.fn(async () => true),
  isSharedPointLayerSetFullyComplete: vi.fn(() => true),
}));

vi.mock('../../../src/utils/layers/styles/index.js', () => layerStylesMock);
vi.mock('../../../src/utils/layer-styles', () => layerStylesMock);
vi.mock('../../../src/utils/layer-styles.js', () => layerStylesMock);

import {
  buildSharedPointFeatureStateHoverPaint,
  applySharedPointLayerPaint,
} from '../../../src/utils/shared-point-paint';
import {
  createSharedPointLayersFromPaint,
  preloadSharedPointLayerStyles,
  syncExistingSharedPointLayers,
  isSharedPointLayerSetComplete,
} from '../../../src/utils/shared-point-sync';
import type { ApplySharedPointPaintOptions } from '../../../src/utils/shared-point-paint';

describe('preloadSharedPointLayerStyles', () => {
  it('is safe to call multiple times', () => {
    expect(() => {
      preloadSharedPointLayerStyles();
      preloadSharedPointLayerStyles();
    }).not.toThrow();
  });
});

describe('buildSharedPointFeatureStateHoverPaint', () => {
  it('builds feature-state hover expressions for glow and point layers', () => {
    const paint = buildSharedPointFeatureStateHoverPaint({
      glowRadius: ['literal', 12],
      glowOpacity: 0.24,
      pointOpacity: 0.92,
      glowHoverOpacity: 0.55,
    });

    expect(paint.glowOpacity[0]).toBe('case');
    expect(paint.pointOpacity[0]).toBe('case');
    expect(paint.glowRadius).toEqual(['*', ['literal', 12], 1.45]);
  });
});


  it('scales interpolate glow radius stops for hover instead of wrapping with multiply', () => {
    const paint = buildSharedPointFeatureStateHoverPaint({
      glowRadius: ['interpolate', ['linear'], ['zoom'], 4, 2.8, 10, 5.6],
      glowOpacity: 0.24,
      pointOpacity: 0.92,
      glowHoverOpacity: 0.55,
    });

    expect(paint.glowRadius[0]).toBe('interpolate');
    expect(paint.glowRadius[4]).toBeCloseTo(2.8 * 1.45);
    expect(paint.glowRadius[6]).toBeCloseTo(5.6 * 1.45);
  });

describe('applySharedPointLayerPaint', () => {
  it('applies feature-state hover paint when featureStateHover is set', () => {
    const setPaintProperty = vi.fn();
    const map = {
      getSource: vi.fn(() => ({})),
      getLayer: vi.fn(() => ({})),
      setPaintProperty,
    };

    applySharedPointLayerPaint(map as never, {
      ids: {
        sourceId: 'demo-points',
        glowLayerId: 'demo-points-glow',
        pointLayerId: 'demo-points-points',
      },
      pointColorExpression: ['literal', '#0060df'],
      pointRadiusExpression: ['literal', 4],
      glowOpacity: 0.24,
      featureStateHover: {
        glowRadius: ['literal', 12],
        glowOpacity: 0.24,
        pointOpacity: 0.92,
        glowHoverOpacity: 0.55,
      },
    });

    expect(setPaintProperty).toHaveBeenCalledWith(
      'demo-points-glow',
      'circle-opacity',
      expect.arrayContaining(['case'])
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      'demo-points-points',
      'circle-stroke-width',
      ['literal', 0]
    );
  });

  it('keeps the shadow on the map spot and floats the badge above it', () => {
    const setPaintProperty = vi.fn();
    const map = {
      getSource: vi.fn(() => ({})),
      getLayer: vi.fn((id: string) =>
        id === 'demo-points-points' ||
        id === 'demo-points-glow' ||
        id === 'demo-points-points-outer-stroke'
          ? {}
          : undefined
      ),
      setPaintProperty,
    };
    const glowRadiusExpression = ['literal', 14] as unknown[];
    const glowTranslate: [number, number] = [0, 0];
    const pointTranslate: [number, number] = [0, -5];

    applySharedPointLayerPaint(map as never, {
      ids: {
        sourceId: 'demo-points',
        glowLayerId: 'demo-points-glow',
        pointLayerId: 'demo-points-points',
      },
      pointColorExpression: ['literal', '#ffffff'],
      pointRadiusExpression: ['literal', 5],
      glowOpacity: 0.4,
      glowBlur: 0.25,
      glowRadiusExpression,
      glowTranslate,
      glowPitchAlignment: 'viewport',
      glowPitchScale: 'viewport',
      pointTranslate,
      outerStrokeWidthExpression: ['literal', 2.5],
      outerStrokeColorExpression: ['literal', '#ffffff'],
      strokeWidthExpression: ['literal', 7],
    });

    expect(setPaintProperty).toHaveBeenCalledWith(
      'demo-points-glow',
      'circle-radius',
      glowRadiusExpression
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      'demo-points-glow',
      'circle-translate',
      glowTranslate
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      'demo-points-glow',
      'circle-pitch-alignment',
      'viewport'
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      'demo-points-glow',
      'circle-pitch-scale',
      'viewport'
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      'demo-points-points',
      'circle-translate',
      pointTranslate
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      'demo-points-points-outer-stroke',
      'circle-translate',
      pointTranslate
    );
  });

});

describe('createSharedPointLayersFromPaint', () => {
  it('pushes forceFallbackKey-annotated GeoJSON after mount so unhovered pins match the key hue', async () => {
    const { sharedPointFloatingBadgeRestingColor } = await import(
      '../../../src/utils/paint/shared-point-paint'
    );
    const setData = vi.fn();
    const map = {
      getSource: vi.fn(() => ({ setData })),
      getLayer: vi.fn(() => ({})),
      setPaintProperty: vi.fn(),
    };
    const ids = {
      sourceId: 'canvas-places',
      glowLayerId: 'canvas-places-glow',
      pointLayerId: 'canvas-places-point',
    };
    const key = sharedPointFloatingBadgeRestingColor('#d580a3', 0.3, 0.45);

    await createSharedPointLayersFromPaint({
      layerSetWaitMs: 0,
      map: map as never,
      ids,
      geojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { mapPromoteId: 'aquarium-conservation' },
            geometry: { type: 'Point', coordinates: [-85.3, 35.0] },
          },
        ],
      },
      paint: {
        ids,
        pointColorExpression: ['literal', '#d580a3'],
        pointRadiusExpression: ['literal', 4],
        selectionGroundBadge: true,
        selectionGroundBadgeFallbackColor: '#d580a3',
        selectionGroundBadgeForceFallbackKey: true,
      },
    });

    expect(setData).toHaveBeenCalled();
    const annotated = setData.mock.calls.at(-1)?.[0] as {
      features: Array<{ properties?: Record<string, unknown> }>;
    };
    expect(annotated.features[0]?.properties?._color).toBe(key);
    expect(annotated.features[0]?.properties?._colorKey).toBe(key);
  });

  it('creates layers with feature-state hover enabled by default', async () => {
    const setPaintProperty = vi.fn();
    const map = {
      getLayer: vi.fn(() => ({})),
      setPaintProperty,
    };

    const ids = {
      sourceId: 'points-louisville',
      glowLayerId: 'louisville-point-glow',
      pointLayerId: 'louisville-point-points',
    };

    const paint: ApplySharedPointPaintOptions = {
      ids,
      pointColorExpression: ['coalesce', ['get', '_color'], '#ccc'],
      pointRadiusExpression: ['literal', 4],
      glowColorExpression: ['coalesce', ['get', '_color'], '#ccc'],
      glowOpacity: 0.24,
    };

    const geojson = { type: 'FeatureCollection' as const, features: [] };

    await createSharedPointLayersFromPaint({
      layerSetWaitMs: 0,
      map: map as never,
      ids,
      geojson,
      paint,
      glowHoverOpacity: 0.3,
      selectionRingColor: '#111',
      promoteId: 'slug',
    });

    expect(createSharedPointLayers).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: ids.sourceId,
        glowLayerId: ids.glowLayerId,
        pointLayerId: ids.pointLayerId,
        circleColor: paint.pointColorExpression,
        glowHoverOpacity: 0.3,
        selectionRingColor: '#111',
        promoteId: 'slug',
        useFeatureStateHover: true,
        glowRadius: ['literal', 12],
      })
    );

    expect(setPaintProperty).toHaveBeenCalledWith(
      'louisville-point-glow',
      'circle-opacity',
      expect.arrayContaining(['case'])
    );
  });

  it('skips hover paint when useFeatureStateHover is false', async () => {
    const setPaintProperty = vi.fn();
    const map = {
      getLayer: vi.fn(() => ({})),
      setPaintProperty,
    };

    const ids = {
      sourceId: 'demo-points',
      glowLayerId: 'points-glow',
      pointLayerId: 'points-points',
    };

    const paint: ApplySharedPointPaintOptions = {
      ids,
      pointColorExpression: ['literal', '#ccc'],
      pointRadiusExpression: ['literal', 4],
    };

    await createSharedPointLayersFromPaint({
      layerSetWaitMs: 0,
      map: map as never,
      ids,
      geojson: { type: 'FeatureCollection', features: [] },
      paint,
      useFeatureStateHover: false,
    });

    expect(createSharedPointLayers).toHaveBeenCalledWith(
      expect.objectContaining({ useFeatureStateHover: false })
    );

    const strokeHoverCalls = setPaintProperty.mock.calls.filter(
      ([, prop, value]: [string, string, unknown]) =>
        prop === 'circle-stroke-width' && Array.isArray(value) && value[0] === 'case'
    );
    expect(strokeHoverCalls).toHaveLength(0);
  });
});

describe('syncExistingSharedPointLayers', () => {
  it('re-applies feature-state hover paint after paint sync', async () => {
    const setPaintProperty = vi.fn();
    const map = {
      getSource: vi.fn(() => ({})),
      getLayer: vi.fn(() => ({})),
      setPaintProperty,
    };

    const ids = {
      sourceId: 'demo-points',
      glowLayerId: 'demo-points-glow',
      pointLayerId: 'demo-points-points',
    };

    const paint: ApplySharedPointPaintOptions = {
      ids,
      pointColorExpression: ['literal', '#0060df'],
      pointRadiusExpression: ['literal', 4],
      glowOpacity: 0.18,
    };

    await syncExistingSharedPointLayers({
      map: map as never,
      ids,
      geojson: { type: 'FeatureCollection', features: [] },
      paint,
      glowHoverOpacity: 0.55,
      glowHitAreaScale: 2.8,
      pointOpacity: 0.58,
    });

    expect(setPaintProperty).toHaveBeenCalledWith(
      'demo-points-glow',
      'circle-opacity',
      expect.arrayContaining(['case'])
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      'demo-points-points',
      'circle-stroke-width',
      ['literal', 0]
    );
  });

  it('forceFallbackKey annotates every feature before setData so pins share one key hue', async () => {
    const { sharedPointFloatingBadgeRestingColor } = await import(
      '../../../src/utils/paint/shared-point-paint'
    );
    const setData = vi.fn();
    const map = {
      getSource: vi.fn(() => ({ setData })),
      getLayer: vi.fn(() => ({})),
      setPaintProperty: vi.fn(),
    };
    const ids = {
      sourceId: 'canvas-places',
      glowLayerId: 'canvas-places-glow',
      pointLayerId: 'canvas-places-point',
    };
    const key = sharedPointFloatingBadgeRestingColor('#d580a3', 0.3, 0.45);

    await syncExistingSharedPointLayers({
      map: map as never,
      ids,
      geojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { mapPromoteId: 'aquarium-conservation' },
            geometry: { type: 'Point', coordinates: [-85.3, 35.0] },
          },
          {
            type: 'Feature',
            properties: { mapPromoteId: 'stem-chattanooga', _color: '#ff00aa' },
            geometry: { type: 'Point', coordinates: [-85.31, 35.05] },
          },
        ],
      },
      paint: {
        ids,
        pointColorExpression: ['literal', '#d580a3'],
        pointRadiusExpression: ['literal', 4],
        selectionGroundBadge: true,
        selectionGroundBadgeFallbackColor: '#d580a3',
        selectionGroundBadgeForceFallbackKey: true,
      },
      healIncompleteLayerSet: false,
    });

    expect(setData).toHaveBeenCalled();
    const annotated = setData.mock.calls.at(-1)?.[0] as {
      features: Array<{ properties?: Record<string, unknown> }>;
    };
    expect(annotated.features.map((f) => f.properties?._color)).toEqual([key, key]);
    expect(annotated.features.map((f) => f.properties?._colorKey)).toEqual([key, key]);
  });
});
describe('isSharedPointLayerSetComplete', () => {
  it('returns false when glow layer is missing', () => {
    const map = {
      getSource: vi.fn(() => ({})),
      getLayer: vi.fn((id: string) => (id === 'demo-points-points' ? {} : null)),
    };

    expect(
      isSharedPointLayerSetComplete(map as never, {
        sourceId: 'demo-points',
        glowLayerId: 'demo-points-glow',
        pointLayerId: 'demo-points-points',
      })
    ).toBe(false);
  });
});

describe('syncExistingSharedPointLayers heal', () => {
  it('creates missing glow layers when point exists without glow', async () => {
    createSharedPointLayers.mockClear();

    const setPaintProperty = vi.fn();
    const map = {
      getSource: vi.fn(() => ({})),
      getLayer: vi.fn((id: string) => (id === 'demo-points-points' ? {} : null)),
      setPaintProperty,
    };

    const ids = {
      sourceId: 'demo-points',
      glowLayerId: 'demo-points-glow',
      pointLayerId: 'demo-points-points',
    };

    const paint: ApplySharedPointPaintOptions = {
      ids,
      pointColorExpression: ['literal', '#0060df'],
      pointRadiusExpression: ['literal', 4],
      glowOpacity: 0.18,
    };

    await syncExistingSharedPointLayers({
      map: map as never,
      ids,
      geojson: { type: 'FeatureCollection', features: [] },
      paint,
      useMapTilerPointHelper: false,
      layerSetWaitMs: 0,
    });

    expect(createSharedPointLayers).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: 'demo-points',
        glowLayerId: 'demo-points-glow',
        pointLayerId: 'demo-points-points',
      })
    );
  });
});
