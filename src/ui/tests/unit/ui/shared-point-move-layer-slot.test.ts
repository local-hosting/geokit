import { describe, expect, it, vi } from 'vitest';

import {
  MAPBOX_VENUE_OVERLAY_SLOT,
  moveSharedPointLayer,
} from '../../../src/utils/paint/shared-point/layer-ids';

describe('moveSharedPointLayer (Mapbox Standard slots)', () => {
  it('uses setSlot top instead of moveLayer when beforeId is omitted', () => {
    const moveLayer = vi.fn();
    const setSlot = vi.fn();
    const map = {
      getLayer: vi.fn((id: string) =>
        id === 'canvas-places-glow' ? { id, slot: 'middle' } : null,
      ),
      moveLayer,
      setSlot,
    };
    moveSharedPointLayer(map as never, 'canvas-places-glow');
    expect(setSlot).toHaveBeenCalledWith('canvas-places-glow', MAPBOX_VENUE_OVERLAY_SLOT);
    expect(moveLayer).not.toHaveBeenCalled();
  });

  it('aligns slots then moveLayer when beforeId is set', () => {
    const moveLayer = vi.fn();
    const setSlot = vi.fn();
    const map = {
      getLayer: vi.fn((id: string) => {
        if (id === 'canvas-places-point') return { id, slot: undefined };
        if (id === 'canvas-places-glow') return { id, slot: 'middle' };
        return null;
      }),
      moveLayer,
      setSlot,
    };
    moveSharedPointLayer(map as never, 'canvas-places-glow', 'canvas-places-point');
    expect(setSlot).toHaveBeenCalled();
    expect(moveLayer).toHaveBeenCalledWith('canvas-places-glow', 'canvas-places-point');
  });
});