import { describe, expect, it, vi } from 'vitest';
import {
  SHARED_POINT_FLOATING_BADGE_FILL,
  sharedPointFloatingBadgeOuterStrokeRadius,
  sharedPointFloatingBadgeRingWidthExpression,
  sharedPointFloatingBadgeSelectedRadiusExpression,
} from '../../../src/utils/paint/shared-point-paint';
import { sharedPointBadgeIconSizeForGlyphDiskExpression } from '../../../src/utils/paint/shared-point-badge-icon-sizing';
import { syncBadgeChrome } from '../../../src/utils/markers/badge';

describe('syncBadgeChrome', () => {
  it('restores white middle ring and outer for place selections', () => {
    const pointLayerId = 'canvas-places-point';
    const setPaintProperty = vi.fn();
    syncBadgeChrome(
      {
        getLayer: (id: string) =>
          id === `${pointLayerId}-selection-badge` ||
          id === `${pointLayerId}-selection-badge-outer`
            ? {}
            : undefined,
        setPaintProperty,
      } as never,
      pointLayerId,
      { keyColor: '#9acd32', badgeGlyph: false }
    );

    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge`,
      'circle-stroke-color',
      SHARED_POINT_FLOATING_BADGE_FILL
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge-outer`,
      'circle-opacity',
      1
    );
  });

  it('collapses to one key disk for glyph selections', () => {
    const pointLayerId = 'canvas-places-point';
    const setPaintProperty = vi.fn();
    const setLayoutProperty = vi.fn();
    const tokens = { coloredRingWidth: 7 } as const;
    const selectedRadius = sharedPointFloatingBadgeSelectedRadiusExpression();
    const ringWidth = sharedPointFloatingBadgeRingWidthExpression(tokens.coloredRingWidth);
    const glyphDiskRadius = sharedPointFloatingBadgeOuterStrokeRadius(selectedRadius, ringWidth);
    syncBadgeChrome(
      {
        getLayer: (id: string) =>
          id === `${pointLayerId}-selection-badge` ||
          id === `${pointLayerId}-selection-badge-outer` ||
          id === `${pointLayerId}-selection-badge-icon`
            ? {}
            : undefined,
        setPaintProperty,
        setLayoutProperty,
      } as never,
      pointLayerId,
      { keyColor: '#9acd32', badgeGlyph: true }
    );

    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge`,
      'circle-radius',
      glyphDiskRadius
    );
    expect(setLayoutProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge-icon`,
      'icon-size',
      sharedPointBadgeIconSizeForGlyphDiskExpression()
    );
  });
});