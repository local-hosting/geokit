import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  clearReservedMapStyleImageIdsForTests,
  isReservedMapStyleImageId,
  loadMapStyleImageAndAdd,
  replaceMapStyleImage,
  reserveMapStyleImageIds,
} from '../../../src/utils/map-surface/map-style-images';
import { createStyleImageMissingHandler } from '../../../src/components/elements/map/style/map-style';

describe('map style images', () => {
  afterEach(() => {
    clearReservedMapStyleImageIdsForTests();
  });

  it('decodes SVG data URLs via HTMLImageElement, not map.loadImage', async () => {
    const addImage = vi.fn();
    const map = {
      loadImage: vi.fn(),
      hasImage: () => false,
      removeImage: vi.fn(),
      addImage,
    };

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 64;
      naturalHeight = 64;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage as never);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      drawImage,
      getImageData: () => ({
        data: new Uint8ClampedArray(64 * 64 * 4).fill(255),
      }),
    } as never);

    await loadMapStyleImageAndAdd(map, 'canvas-badge-cube', 'data:image/svg+xml;base64,PHN2Zy8+');

    expect(map.loadImage).not.toHaveBeenCalled();
    expect(addImage).toHaveBeenCalledWith(
      'canvas-badge-cube',
      expect.objectContaining({
        width: 64,
        height: 64,
        data: expect.any(Uint8ClampedArray),
      }),
      expect.objectContaining({ pixelRatio: 1 })
    );

    vi.unstubAllGlobals();
  });

  it('loads raster urls via loadImage and addImage (MapLibre idiom)', async () => {
    const image = { width: 64, height: 64, data: new Uint8Array(64 * 64 * 4) };
    const map = {
      loadImage: vi.fn((_url: string, cb: (error: null, image: unknown) => void) => {
        cb(null, image);
      }),
      hasImage: vi.fn(() => false),
      removeImage: vi.fn(),
      addImage: vi.fn(),
    };

    await loadMapStyleImageAndAdd(map, 'marker-pin', 'https://example.com/pin.png');

    expect(map.loadImage).toHaveBeenCalledWith('https://example.com/pin.png', expect.any(Function));
    expect(map.addImage).toHaveBeenCalledWith('marker-pin', image, { pixelRatio: 1 });
  });

  it('replaceMapStyleImage removes an existing sprite before addImage', () => {
    const map = {
      hasImage: () => true,
      removeImage: vi.fn(),
      addImage: vi.fn(),
    };
    replaceMapStyleImage(map, 'glyph', { width: 2, height: 2, data: new Uint8Array(16) });
    expect(map.removeImage).toHaveBeenCalledWith('glyph');
    expect(map.addImage).toHaveBeenCalled();
  });

  it('reserved ids skip the generic styleimagemissing placeholder', () => {
    reserveMapStyleImageIds('canvas-badge-cube');
    expect(isReservedMapStyleImageId('canvas-badge-cube')).toBe(true);

    const addImage = vi.fn();
    const handler = createStyleImageMissingHandler({
      on: vi.fn(),
      addImage,
      hasImage: () => false,
    } as never);

    handler?.({ id: 'canvas-badge-cube' });
    expect(addImage).not.toHaveBeenCalled();
  });
});