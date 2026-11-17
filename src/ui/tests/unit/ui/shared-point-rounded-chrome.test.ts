import { describe, expect, it, vi } from 'vitest';
import {
  sharedPointCircleStackLayerIds,
  sharedPointCombineLayerFilters,
  sharedPointCircleBodyFilter,
  sharedPointRoundedRectBodyFilter,
} from '../../../src/utils/markers/marker-shape';
import {
  reapplyFloatingBadgeSelectionChromeIfActive,
} from '../../../src/utils/markers/marker-selection-chrome';
import {
  sharedPointRoundedBodyIconSizeExpression,
  sharedPointRoundedBodyLayerId,
  sharedPointRoundedOuterIconSizeExpression,
  sharedPointRoundedOuterLayerId,
  sharedPointSelectionRoundedBodyLayerId,
  sharedPointSelectionRoundedOuterLayerId,
} from '../../../src/utils/paint/shared-point-rounded-body';
import {
  SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  sampleZoomInterpolateValue,
  sharedPointSelectionBadgeLayerId,
  syncSharedPointSelectedLayerFilter,
} from '../../../src/utils/paint/shared-point-paint';

describe('rounded-rect map chrome', () => {
  it('does not apply circle-only filters to selection-badge layers', () => {
    const ids = sharedPointCircleStackLayerIds('pts', 'pts-glow');
    expect(ids).not.toContain('pts-selection-badge');
    expect(ids).not.toContain('pts-selection-badge-outer');
    expect(ids).not.toContain('pts-selection-shadow');
  });

  it('combines shape and selection exclusion filters', () => {
    const combined = sharedPointCombineLayerFilters(
      sharedPointCircleBodyFilter(),
      ['!=', ['to-string', ['get', 'mapPromoteId']], 'r1']
    );
    expect(combined).toEqual(['all', sharedPointCircleBodyFilter(), expect.any(Array)]);
  });

  it('restores circle shape filter when selection clears', () => {
    const setFilter = vi.fn();
    const map = {
      getLayer: vi.fn((id: string) =>
        id === 'pts' ||
        id === sharedPointRoundedBodyLayerId('pts') ||
        id === sharedPointRoundedOuterLayerId('pts')
          ? {}
          : undefined
      ),
      setFilter,
    };

    syncSharedPointSelectedLayerFilter(map as never, {
      pointLayerId: 'pts',
      promoteId: 'mapPromoteId',
      featureId: null,
    });

    expect(setFilter).toHaveBeenCalledWith('pts', sharedPointCircleBodyFilter());
    expect(setFilter).toHaveBeenCalledWith(
      sharedPointRoundedBodyLayerId('pts'),
      sharedPointRoundedRectBodyFilter()
    );
  });

  it('exposes selection-source rounded layer ids', () => {
    expect(sharedPointSelectionRoundedBodyLayerId('pts')).toBe('pts-selection-rounded-body');
  });

  it('keeps rounded icon-size as interpolate (not invalid + trees)', () => {
    const body = sharedPointRoundedBodyIconSizeExpression();
    const outer = sharedPointRoundedOuterIconSizeExpression(undefined, 7, 3);
    expect(body[0]).toBe('interpolate');
    expect(outer[0]).toBe('interpolate');
    expect(outer).not.toEqual(body);
  });

  it('scales icon-size to match circle diameter (2×radius / image width)', () => {
    const body = sharedPointRoundedBodyIconSizeExpression();
    const z14Idx = body.indexOf(14);
    expect(z14Idx).toBeGreaterThan(0);
    const iconSizeAt14 = body[z14Idx + 1];
    const radiusAt14 = sampleZoomInterpolateValue(SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION, 14);
    expect(iconSizeAt14).toBeCloseTo((radiusAt14 * 2) / 64, 5);
  });

  it('keeps resource selection chrome when stack paint runs with an active selection', () => {
    const pointLayerId = 'pts';
    const sourceId = 'pts-src';
    const setPaintProperty = vi.fn();
    const map = {
      getLayer: vi.fn((id: string) =>
        [
          sharedPointRoundedBodyLayerId(pointLayerId),
          sharedPointSelectionRoundedBodyLayerId(pointLayerId),
          sharedPointSelectionRoundedOuterLayerId(pointLayerId),
          `${pointLayerId}-selection-rounded-ring`,
          sharedPointSelectionBadgeLayerId(pointLayerId),
          `${pointLayerId}-selection-badge-outer`,
          `${pointLayerId}-selection-badge-icon`,
        ].includes(id)
          ? {}
          : undefined
      ),
      getSource: vi.fn((id: string) =>
        id === `${sourceId}-selection`
          ? {
              _data: {
                features: [
                  {
                    properties: {
                      _badgeIcon: 'resource-cube',
                      _color: '#9acd32',
                    },
                  },
                ],
              },
            }
          : undefined
      ),
      setPaintProperty,
    };

    reapplyFloatingBadgeSelectionChromeIfActive(
      map as never,
      { sourceId, pointLayerId, glowLayerId: 'pts-glow' },
      {
        ids: { sourceId, pointLayerId, glowLayerId: 'pts-glow' },
        selectionGroundBadgeFallbackColor: '#888888',
      }
    );

    // Shadow-only select — selection-source rounded chrome stays hidden.
    expect(setPaintProperty).toHaveBeenCalledWith(
      sharedPointSelectionBadgeLayerId(pointLayerId),
      'circle-opacity',
      0
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      sharedPointSelectionRoundedBodyLayerId(pointLayerId),
      'icon-opacity',
      0
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge-icon`,
      'icon-opacity',
      0
    );
  });
});