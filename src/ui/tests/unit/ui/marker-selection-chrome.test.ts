import { describe, expect, it, vi } from 'vitest';
import {
  applyFloatingBadgeSelectionChrome,
  buildFloatingBadgeSelectedChromeSpec,
  floatingBadgeBodyShapeFromProperties,
} from '../../../src/utils/markers/marker-selection-chrome';
import {
  SHARED_POINT_FLOATING_BADGE_FILL,
  sharedPointFloatingBadgeSelectedColor,
} from '../../../src/utils/paint/shared-point-paint';

describe('marker-selection-chrome', () => {
  const pointLayerId = 'canvas-places-point';

  it('derives body shape the same way for places and resources', () => {
    expect(floatingBadgeBodyShapeFromProperties({ placeId: 'dock' })).toBe('circle');
    expect(
      floatingBadgeBodyShapeFromProperties({
        _badgeIcon: 'cube',
        _markerShape: 'rounded-rect',
      })
    ).toBe('rounded-rect');
  });

  it('uses one entry point for circle vs rounded selection chrome', () => {
    const key = '#9acd32';
    const fill = sharedPointFloatingBadgeSelectedColor(key);
    const setPaintProperty = vi.fn();
    const setLayoutProperty = vi.fn();

    applyFloatingBadgeSelectionChrome(
      {
        getLayer: (id: string) => (id.startsWith(pointLayerId) ? {} : undefined),
        setPaintProperty,
        setLayoutProperty,
      } as never,
      pointLayerId,
      { accentColor: fill, shape: 'circle' }
    );

    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge`,
      'circle-stroke-color',
      SHARED_POINT_FLOATING_BADGE_FILL
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge-outer`,
      'circle-color',
      fill
    );

    setPaintProperty.mockClear();
    applyFloatingBadgeSelectionChrome(
      {
        getLayer: (id: string) => (id.startsWith(pointLayerId) ? {} : undefined),
        setPaintProperty,
        setLayoutProperty,
      } as never,
      pointLayerId,
      { accentColor: fill, shape: 'rounded-rect' }
    );

    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge`,
      'circle-opacity',
      0
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-rounded-body`,
      'icon-color',
      fill
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-rounded-ring`,
      'icon-color',
      SHARED_POINT_FLOATING_BADGE_FILL
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-rounded-outer`,
      'icon-color',
      fill
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge-icon`,
      'icon-color',
      fill
    );
  });

  it('builds the same selected color stack for both shapes', () => {
    const spec = buildFloatingBadgeSelectedChromeSpec('#9acd32');
    expect(spec.accentColor).toBe('#9acd32');
    expect(spec.white).toBe(SHARED_POINT_FLOATING_BADGE_FILL);
    expect(spec.selectedRadius).toBeTruthy();
    expect(spec.outerDiscRadius).toBeTruthy();
  });
});