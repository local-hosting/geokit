import { describe, expect, it, vi } from 'vitest';
import { hideFloatingBadgeCircleSelectionLayers } from '../../../src/utils/paint/shared-point-paint';

describe('hideFloatingBadgeCircleSelectionLayers', () => {
  it('hides circle selection disks when the rounded stack is active', () => {
    const pointLayerId = 'canvas-places-point';
    const setPaintProperty = vi.fn();
    const map = {
      getLayer: (id: string) =>
        id === `${pointLayerId}-selection-badge` ||
        id === `${pointLayerId}-selection-badge-outer`
          ? {}
          : undefined,
      setPaintProperty,
    };

    hideFloatingBadgeCircleSelectionLayers(map as never, pointLayerId);

    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge`,
      'circle-opacity',
      0
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge-outer`,
      'circle-stroke-opacity',
      0
    );
  });
});