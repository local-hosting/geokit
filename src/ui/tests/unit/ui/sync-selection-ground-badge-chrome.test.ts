import { describe, expect, it, vi } from 'vitest';
import {
  SHARED_POINT_FLOATING_BADGE_FILL,
  sampleZoomInterpolateValue,
  sharedPointFloatingBadgeSelectedColor,
} from '../../../src/utils/paint/shared-point-paint';
import { sharedPointBadgeIconSizeExpression } from '../../../src/utils/paint/shared-point-badge-icon-sizing';
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

    // White middle ring zoomed in (step's last value); key color zoomed out.
    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge`,
      'circle-stroke-color',
      expect.arrayContaining(['step', SHARED_POINT_FLOATING_BADGE_FILL])
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge-outer`,
      'circle-opacity',
      1
    );
  });

  it('hides circle selection badges and paints rounded-rect selection chrome', () => {
    const pointLayerId = 'canvas-places-point';
    const setPaintProperty = vi.fn();
    const setLayoutProperty = vi.fn();
    syncBadgeChrome(
      {
        getLayer: (id: string) =>
          id === `${pointLayerId}-selection-badge` ||
          id === `${pointLayerId}-selection-badge-outer` ||
          id === `${pointLayerId}-selection-badge-icon` ||
          id === `${pointLayerId}-selection-rounded-body` ||
          id === `${pointLayerId}-selection-rounded-outer`
            ? {}
            : undefined,
        setPaintProperty,
        setLayoutProperty,
      } as never,
      pointLayerId,
      {
        keyColor: '#9acd32',
        properties: { _badgeIcon: 'cube', _color: '#9acd32', _markerShape: 'rounded-rect' },
      }
    );

    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge`,
      'circle-opacity',
      0
    );
    const fill = sharedPointFloatingBadgeSelectedColor('#9acd32');
    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-rounded-body`,
      'icon-color',
      expect.arrayContaining(['step', SHARED_POINT_FLOATING_BADGE_FILL])
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge-icon`,
      'icon-color',
      expect.arrayContaining(['step', fill])
    );
    // Same glyph size zoomed in (the selected dot only grows zoomed out, where the glyph hides).
    const iconSizeCall = setLayoutProperty.mock.calls.find(
      (call) => call[0] === `${pointLayerId}-selection-badge-icon` && call[1] === 'icon-size'
    );
    expect(sampleZoomInterpolateValue(iconSizeCall?.[2] as unknown[], 12)).toBeCloseTo(
      sampleZoomInterpolateValue(sharedPointBadgeIconSizeExpression(), 12)
    );
  });

  it('does not query rounded selection layers before they exist on the map', () => {
    const pointLayerId = 'canvas-places-point';
    const roundedBodyId = `${pointLayerId}-selection-rounded-body`;
    const getPaintProperty = vi.fn((layerId: string) => {
      if (layerId === roundedBodyId) {
        throw new TypeError("Cannot read properties of undefined (reading 'style')");
      }
      return [0, -8];
    });
    expect(() =>
      syncBadgeChrome(
        {
          getLayer: (id: string) =>
            id === `${pointLayerId}-selection-badge` ||
            id === `${pointLayerId}-selection-badge-outer` ||
            id === `${pointLayerId}-selection-badge-icon`
              ? {}
              : undefined,
          setPaintProperty: vi.fn(),
          getPaintProperty,
        } as never,
        pointLayerId,
        {
        keyColor: '#9acd32',
        properties: { _badgeIcon: 'cube', _color: '#9acd32', _markerShape: 'rounded-rect' },
      }
      )
    ).not.toThrow();
    expect(getPaintProperty).not.toHaveBeenCalledWith(roundedBodyId, 'icon-translate');
  });
});