import { afterEach, describe, expect, it, vi } from 'vitest';

import { setSharedPointSelection } from '../../../src/utils/layers/styles/shared-point-layers';
import {
  SHARED_POINT_FLOATING_BADGE_FLOAT_TRANSLATE,
  SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE,
} from '../../../src/utils/shared-point-paint';

const sourceId = 'canvas-venues';
const pointLayerId = 'canvas-venues-point';
const badgeLayerId = `${pointLayerId}-selection-badge`;

function mapHoldingPreviousLift() {
  const setPaintProperty = vi.fn();
  return {
    getSource: (id: string) =>
      id === `${sourceId}-selection` ? { setData: vi.fn(), _data: null } : undefined,
    getLayer: (id: string) => (id === badgeLayerId ? { type: 'circle' } : undefined),
    // The shared selection layers still hold the last selected marker's settled offset.
    getPaintProperty: vi.fn(() => [...SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE]),
    setPaintProperty,
    setFeatureState: vi.fn(),
    removeFeatureState: vi.fn(),
    addLayer: vi.fn(),
    moveLayer: vi.fn(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('selecting a different marker', () => {
  it('starts the settle animation from rest, not from the previous marker offset', () => {
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1);
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    const map = mapHoldingPreviousLift();

    setSharedPointSelection(
      map as never,
      sourceId,
      { featureId: 'buffalo-harbor', lngLat: { lng: -78.9, lat: 42.88 }, properties: {} },
      { pointLayerId, selectionGroundBadge: true }
    );

    const first = map.setPaintProperty.mock.calls.find(
      (call) => call[0] === badgeLayerId && call[1] === 'circle-translate'
    );
    expect(first?.[2]).toEqual(SHARED_POINT_FLOATING_BADGE_FLOAT_TRANSLATE);
  });
});
