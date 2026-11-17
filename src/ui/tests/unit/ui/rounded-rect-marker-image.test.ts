import { describe, expect, it, vi } from 'vitest';

import {
  GK_ROUNDED_RECT_MARKER_IMAGE_ID,
  registerRoundedRectMarkerImage,
} from '../../../src/utils/paint/shared-point-rounded-body';
import { GK_ROUNDED_RECT_SHADOW_IMAGE_ID } from '../../../src/utils/paint/shared-point-rounded-shadow';

describe('registerRoundedRectMarkerImage', () => {
  it('replaces an existing styleimagemissing placeholder instead of keeping the black 1×1', () => {
    const removeImage = vi.fn();
    const addImage = vi.fn();
    const map = {
      getCanvas: () => ({ width: 100, height: 100 }),
      hasImage: () => true,
      removeImage,
      addImage,
    };

    expect(registerRoundedRectMarkerImage(map as never)).toBe(true);
    expect(removeImage).toHaveBeenCalledWith(GK_ROUNDED_RECT_MARKER_IMAGE_ID);
    expect(removeImage).toHaveBeenCalledWith(GK_ROUNDED_RECT_SHADOW_IMAGE_ID);
    expect(addImage).toHaveBeenCalledWith(
      GK_ROUNDED_RECT_MARKER_IMAGE_ID,
      expect.objectContaining({ width: 128, height: 128 }),
      expect.objectContaining({ sdf: true })
    );
    expect(addImage).toHaveBeenCalledWith(
      GK_ROUNDED_RECT_SHADOW_IMAGE_ID,
      expect.objectContaining({ width: 128, height: 128 }),
      expect.objectContaining({ pixelRatio: 2 })
    );
  });
});
