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

describe('rounded-rect resting core matches circle light inner', () => {
  it('paints the rounded body with the same light core as circle pointColorExpression', () => {
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
    const ringColor = ['coalesce', ['get', '_color'], resting];
    const expectedCore = sharedPointZoomedOutStep(
      sharedPointDotColorExpression(ringColor),
      SHARED_POINT_FLOATING_BADGE_FILL
    );

    expect(setPaintProperty).toHaveBeenCalledWith(bodyId, 'icon-color', expectedCore);
    // Zoomed-in branch must be the light fill, not the solid key ring.
    expect(JSON.stringify(expectedCore)).toContain(SHARED_POINT_FLOATING_BADGE_FILL);
    expect(paint.pointColorExpression).toEqual(expectedCore);
  });

  it('tints the resource glyph with the key ring (visible on the light core)', () => {
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

    const resting = sharedPointFloatingBadgeRestingColor('#c9a86c');
    const keyRing = ['coalesce', ['get', '_color'], resting];
    expect(setPaintProperty).toHaveBeenCalledWith(
      'canvas-places-point-badge-icon',
      'icon-color',
      sharedPointZoomedOutStep('rgba(0,0,0,0)', keyRing)
    );
  });

  it('keeps corners clearly rectangular (not a near-circle squircle)', () => {
    expect(ROUNDED_RECT_CORNER_RATIO_OF_WIDTH).toBeLessThanOrEqual(0.16);
    expect(ROUNDED_RECT_CORNER_RATIO_OF_WIDTH).toBeGreaterThanOrEqual(0.1);
  });
});
