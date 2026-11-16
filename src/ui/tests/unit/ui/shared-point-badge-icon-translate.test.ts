import { describe, expect, it, vi } from 'vitest';
import {
  healSharedPointBadgeIconTranslate,
  sharedPointSelectionBadgeIconLayerId,
} from '../../../src/utils/paint/shared-point-badge-icon';

describe('healSharedPointBadgeIconTranslate', () => {
  it('copies selection badge circle-translate onto the icon layer paint', () => {
    const pointLayerId = 'canvas-places-point';
    const iconLayerId = sharedPointSelectionBadgeIconLayerId(pointLayerId);
    const badgeLayerId = `${pointLayerId}-selection-badge`;
    const setPaintProperty = vi.fn();
    const setLayoutProperty = vi.fn();

    healSharedPointBadgeIconTranslate(
      {
        getLayer: (id: string) =>
          id === badgeLayerId || id === iconLayerId ? {} : undefined,
        getPaintProperty: (id: string, prop: string) => {
          if (id === badgeLayerId && prop === 'circle-translate') return [0, -6];
          return undefined;
        },
        setPaintProperty,
        setLayoutProperty,
      } as never,
      pointLayerId
    );

    expect(setPaintProperty).toHaveBeenCalledWith(
      iconLayerId,
      'icon-translate-anchor',
      'viewport'
    );
    expect(setPaintProperty).toHaveBeenCalledWith(iconLayerId, 'icon-translate', [0, -6]);
    expect(setLayoutProperty).not.toHaveBeenCalled();
  });
});
