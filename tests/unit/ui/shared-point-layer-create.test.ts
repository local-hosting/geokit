import { describe, expect, it, vi } from 'vitest';

const { createSharedPointLayers } = vi.hoisted(() => ({
  createSharedPointLayers: vi.fn(),
}));

vi.mock('../../../src/ui/utils/map-utils', () => ({
  updateSourceData: vi.fn(() => true),
}));

vi.mock('../../../src/ui/utils/layer-styles', () => ({
  createSharedPointLayers,
  getGlowRadiusInterpolation: () => ['literal', 12],
}));

import {
  buildSharedPointFeatureStateHoverPaint,
  applySharedPointLayerPaint,
} from '../../../src/ui/utils/shared-point-paint';
import {
  createSharedPointLayersFromPaint,
  preloadSharedPointLayerStyles,
  syncExistingSharedPointLayers,
} from '../../../src/ui/utils/shared-point-sync';
import type { ApplySharedPointPaintOptions } from '../../../src/ui/utils/shared-point-paint';

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
    expect(paint.pointStrokeWidth[0]).toBe('case');
    expect(paint.pointStrokeColor[0]).toBe('case');
    expect(paint.glowRadius).toEqual(['*', ['literal', 12], 1.35]);
  });
});

describe('applySharedPointLayerPaint', () => {
  it('applies feature-state hover paint when featureStateHover is set', () => {
    const setPaintProperty = vi.fn();
    const map = {
      getLayer: vi.fn(() => ({})),
      setPaintProperty,
    };

    applySharedPointLayerPaint(map as never, {
      ids: {
        sourceId: 'stores',
        glowLayerId: 'stores-glow',
        pointLayerId: 'stores-points',
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
      'stores-glow',
      'circle-opacity',
      expect.arrayContaining(['case'])
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      'stores-points',
      'circle-stroke-width',
      expect.arrayContaining(['case'])
    );
  });
});

describe('createSharedPointLayersFromPaint', () => {
  it('creates layers with feature-state hover enabled by default', async () => {
    const setPaintProperty = vi.fn();
    const map = {
      getLayer: vi.fn(() => ({})),
      setPaintProperty,
    };

    const ids = {
      sourceId: 'venues-louisville',
      glowLayerId: 'louisville-venue-glow',
      pointLayerId: 'louisville-venue-points',
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
      })
    );

    expect(setPaintProperty).toHaveBeenCalledWith(
      'louisville-venue-glow',
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
      sourceId: 'venues',
      glowLayerId: 'venues-glow',
      pointLayerId: 'venues-points',
    };

    const paint: ApplySharedPointPaintOptions = {
      ids,
      pointColorExpression: ['literal', '#ccc'],
      pointRadiusExpression: ['literal', 4],
    };

    await createSharedPointLayersFromPaint({
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
      getLayer: vi.fn(() => ({})),
      setPaintProperty,
    };

    const ids = {
      sourceId: 'stores',
      glowLayerId: 'stores-glow',
      pointLayerId: 'stores-points',
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
      'stores-glow',
      'circle-opacity',
      expect.arrayContaining(['case'])
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      'stores-points',
      'circle-stroke-width',
      expect.arrayContaining(['case'])
    );
  });
});
