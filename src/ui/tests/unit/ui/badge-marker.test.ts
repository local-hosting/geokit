import { describe, expect, it, vi } from 'vitest';
import {
  SHARED_POINT_FLOATING_BADGE_FILL,
  sharedPointSelectedMiddleRingColor,
} from '../../../src/utils/paint/shared-point-paint';
import { badgePreset, createBadgeMarker } from '../../../src/utils/markers/badge';

describe('badge marker', () => {
  const ids = {
    sourceId: 'canvas-places',
    pointLayerId: 'canvas-places-point',
    glowLayerId: 'canvas-places-glow',
  };

  it('includes glass and rounded body layers in stack', () => {
    const stack = badgePreset.inventory.layerStack(ids);
    expect(stack).toContain('canvas-places-point-glass');
    expect(stack).toContain('canvas-places-point-rounded-body');
    expect(stack).toContain('canvas-places-point-rounded-ring');
    expect(stack).toContain('canvas-places-point-rounded-outer');
  });

  it('builds paint config', () => {
    const paint = createBadgeMarker({ ids, fallbackColor: '#2dbad2' }).buildPaintConfig();
    expect(paint.selectionGroundBadge).toBe(true);
  });

  it('uses rounded-rect body shape for resource features', () => {
    const marker = createBadgeMarker({ ids, fallbackColor: '#888888' });
    expect(marker.shapeFrom({ _badgeIcon: 'cube' })).toBe('rounded-rect');
    expect(marker.shapeFrom({ placeId: 'dock' })).toBe('circle');
  });

  it('treats marker shape as resource when badge icon is omitted', () => {
    const marker = createBadgeMarker({ ids, fallbackColor: '#888888' });
    expect(marker.variantFrom({ _markerShape: 'rounded-rect', venueId: 'dock' })).toBe('resource');
  });

  it('applies place vs resource chrome', () => {
    const pointLayerId = ids.pointLayerId;
    const setPaintProperty = vi.fn();
    const setLayoutProperty = vi.fn();
    const map = {
      getLayer: (id: string) => (id.startsWith(pointLayerId) ? {} : undefined),
      setPaintProperty,
      setLayoutProperty,
    };
    const marker = createBadgeMarker({ ids, fallbackColor: '#888888' });

    marker.applyState(map as never, {
      phase: 'selected',
      accentColor: '#9acd32',
      variant: 'resource',
    });
    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge`,
      'circle-opacity',
      0
    );

    setPaintProperty.mockClear();
    marker.applyState(map as never, {
      phase: 'selected',
      accentColor: '#9acd32',
      variant: 'place',
    });
    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge`,
      'circle-stroke-color',
      sharedPointSelectedMiddleRingColor('#9acd32', SHARED_POINT_FLOATING_BADGE_FILL)
    );
  });
});