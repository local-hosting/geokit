/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import {
  SHARED_POINT_FLOATING_BADGE_FILL,
  sharedPointDotColorExpression,
  sharedPointFloatingBadgePaintExpressions,
  sharedPointFloatingBadgeRestingColor,
  sharedPointZoomedOutStep,
} from '../../../src/utils/paint/shared-point-paint';
import {
  applySharedPointRoundedRectChromePaint,
  sharedPointRoundedBodyLayerId,
} from '../../../src/utils/paint/shared-point-rounded-body';
import { ROUNDED_RECT_CORNER_RATIO_OF_WIDTH } from '../../../src/utils/paint/rounded-rect-raster';

describe('rounded-rect resource badge chrome', () => {
  it('paints the rounded body with a key-colored core (white glyph sits on it)', () => {
    const paint = sharedPointFloatingBadgePaintExpressions({
      fallbackColor: '#d580a3',
      themeElement: null,
    });
    const setPaintProperty = vi.fn();
    const bodyId = sharedPointRoundedBodyLayerId('canvas-places-point');
    const map = {
      getLayer: (id: string) =>
        id.includes('rounded') || id.endsWith('-badge-icon') ? {} : undefined,
      setPaintProperty,
      getSource: () => null,
    };

    applySharedPointRoundedRectChromePaint(map as never, 'canvas-places-point', {
      ...paint,
      ids: {
        sourceId: 'canvas-places',
        pointLayerId: 'canvas-places-point',
        glowLayerId: 'canvas-places-glow',
      },
    });

    const resting = sharedPointFloatingBadgeRestingColor('#d580a3');
    const keyRing = ['coalesce', ['get', '_color'], resting];
    const expectedCore = sharedPointZoomedOutStep(
      sharedPointDotColorExpression(keyRing),
      keyRing
    );

    expect(setPaintProperty).toHaveBeenCalledWith(bodyId, 'icon-color', expectedCore);
    // Zoomed-in branch must be the solid key — not paper fill — so the white cube reads.
    expect(JSON.stringify(expectedCore)).not.toContain(SHARED_POINT_FLOATING_BADGE_FILL);
  });

  it('tints the resource glyph white (visible on the key-colored core)', () => {
    const paint = sharedPointFloatingBadgePaintExpressions({
      fallbackColor: '#c9a86c',
      themeElement: null,
    });
    const setPaintProperty = vi.fn();
    const map = {
      getLayer: (id: string) =>
        id.includes('rounded') || id.endsWith('-badge-icon') ? {} : undefined,
      setPaintProperty,
      getSource: () => null,
    };

    applySharedPointRoundedRectChromePaint(map as never, 'canvas-places-point', {
      ...paint,
      ids: {
        sourceId: 'canvas-places',
        pointLayerId: 'canvas-places-point',
        glowLayerId: 'canvas-places-glow',
      },
    });

    expect(setPaintProperty).toHaveBeenCalledWith(
      'canvas-places-point-badge-icon',
      'icon-color',
      sharedPointZoomedOutStep('rgba(0,0,0,0)', SHARED_POINT_FLOATING_BADGE_FILL)
    );
  });

  it('keeps corners clearly rectangular (not a near-circle squircle)', () => {
    expect(ROUNDED_RECT_CORNER_RATIO_OF_WIDTH).toBeLessThanOrEqual(0.16);
    expect(ROUNDED_RECT_CORNER_RATIO_OF_WIDTH).toBeGreaterThanOrEqual(0.1);
  });
});
