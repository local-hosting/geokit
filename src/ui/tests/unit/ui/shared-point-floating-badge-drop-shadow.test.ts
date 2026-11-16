import { describe, expect, it, vi } from 'vitest';

import { setupSelectionGroundBadgeLayers } from '../../../src/utils/layers/styles/shared-point-layers';
import {
  SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE,
  sampleZoomInterpolateValue,
  sharedPointFloatingBadgeOuterDiscRadius,
  sharedPointFloatingBadgeOuterStrokeWidthExpression,
  sharedPointFloatingBadgePaintExpressions,
  sharedPointFloatingBadgeRingWidthExpression,
} from '../../../src/utils/shared-point-paint';

const outerDisc = sharedPointFloatingBadgeOuterDiscRadius(
  SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  sharedPointFloatingBadgeRingWidthExpression(),
  sharedPointFloatingBadgeOuterStrokeWidthExpression()
) as unknown[];

function paint() {
  return sharedPointFloatingBadgePaintExpressions({ fallbackColor: '#908ac7', themeElement: null });
}

describe('floating badge drop shadow', () => {
  it('stays round and casts straight down the screen when the map is pitched', () => {
    const p = paint();
    expect(p.glowPitchAlignment).toBe('viewport');
    expect(p.glowTranslateAnchor).toBe('viewport');
    expect(SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE[0]).toBe(0);
  });

  it('peeks below the full badge (fill + ring + outer band) at city and street zoom', () => {
    const shadow = paint().glowRadiusExpression as unknown[];
    for (const zoom of [14, 16]) {
      const badge = sampleZoomInterpolateValue(outerDisc, zoom);
      const radius = sampleZoomInterpolateValue(shadow, zoom);
      expect(radius).toBeGreaterThanOrEqual(badge);
      expect(radius + SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE[1] * 0.9).toBeGreaterThanOrEqual(
        badge + 8
      );
    }
  });

  it('hugs the badge when zoomed out (no fat disks)', () => {
    const shadow = paint().glowRadiusExpression as unknown[];
    expect(
      sampleZoomInterpolateValue(shadow, 6) - sampleZoomInterpolateValue(outerDisc, 6)
    ).toBeLessThanOrEqual(1.25);
  });

  it('screen-aligns the selected badge shadow too', () => {
    const pointLayerId = 'canvas-places-point';
    const sourceId = 'canvas-places';
    const layers = new Set<string>();
    const setPaintProperty = vi.fn();
    const map = {
      getSource: (id: string) => (id === `${sourceId}-selection` ? {} : undefined),
      getLayer: (id: string) => (layers.has(id) || id === pointLayerId ? {} : undefined),
      addLayer: vi.fn((spec: { id: string }) => layers.add(spec.id)),
      setPaintProperty,
      moveLayer: vi.fn(),
    };

    setupSelectionGroundBadgeLayers(map as never, sourceId, pointLayerId, {
      fallbackColor: '#908ac7',
    });

    const shadowId = `${pointLayerId}-selection-shadow`;
    expect(setPaintProperty).toHaveBeenCalledWith(shadowId, 'circle-pitch-alignment', 'map');
    expect(setPaintProperty).toHaveBeenCalledWith(shadowId, 'circle-pitch-scale', 'map');
  });
});
