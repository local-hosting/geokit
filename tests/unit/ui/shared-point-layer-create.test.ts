import { describe, expect, it, vi } from 'vitest';

const createSharedPointLayers = vi.fn();

vi.mock('../../../src/ui/utils/map-utils', () => ({
  updateSourceData: vi.fn(() => true),
}));

vi.mock('../../../src/ui/utils/layer-styles', () => ({
  createSharedPointLayers,
  getGlowRadiusInterpolation: () => ['literal', 12],
}));

import {
  createSharedPointLayersFromPaint,
  preloadSharedPointLayerStyles,
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

describe('createSharedPointLayersFromPaint', () => {
  it('creates layers then applies paint from app config', async () => {
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
        useFeatureStateHover: false,
      })
    );

    expect(setPaintProperty).toHaveBeenCalled();
  });
});
