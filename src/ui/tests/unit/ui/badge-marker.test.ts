import { describe, expect, it, vi } from 'vitest';
import { SHARED_POINT_FLOATING_BADGE_FILL } from '../../../src/utils/paint/shared-point-paint';
import { badgePreset, createBadgeMarker } from '../../../src/utils/markers/badge';

describe('badge marker', () => {
  const ids = {
    sourceId: 'canvas-places',
    pointLayerId: 'canvas-places-point',
    glowLayerId: 'canvas-places-glow',
  };

  it('includes glass in layer stack', () => {
    expect(badgePreset.inventory.layerStack(ids)).toContain('canvas-places-point-glass');
  });

  it('builds paint config', () => {
    const paint = createBadgeMarker({ ids, fallbackColor: '#2dbad2' }).buildPaintConfig();
    expect(paint.selectionGroundBadge).toBe(true);
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
      'circle-stroke-width',
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
      SHARED_POINT_FLOATING_BADGE_FILL
    );
  });
});