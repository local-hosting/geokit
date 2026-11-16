/**
 * MapLibre / Mapbox GL idioms: `loadImage` → `addImage`, `styleimagemissing`.
 * @see https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#loadimage
 */

export type MapStyleImageOptions = {
  pixelRatio?: number;
  sdf?: boolean;
};

export type MapStyleImageHost = {
  loadImage?: (
    url: string,
    callback: (
      error?: Error | null,
      image?: HTMLImageElement | ImageBitmap | { width: number; height: number; data: ArrayBufferView }
    ) => void
  ) => void;
  addImage?: (id: string, image: unknown, options?: MapStyleImageOptions) => void;
  hasImage?: (id: string) => boolean;
  removeImage?: (id: string) => void;
};

const reservedStyleImageIds = new Set<string>();

/** Skip GeoKit 1×1 `styleimagemissing` placeholders for ids loaded via {@link loadMapStyleImageAndAdd}. */
export function reserveMapStyleImageIds(...ids: string[]): void {
  for (const id of ids) {
    const key = id.trim();
    if (key) reservedStyleImageIds.add(key);
  }
}

export function isReservedMapStyleImageId(id: string): boolean {
  return reservedStyleImageIds.has(id.trim());
}

export function clearReservedMapStyleImageIdsForTests(): void {
  reservedStyleImageIds.clear();
}

export const DEFAULT_STYLE_IMAGE_RASTER_SIZE = 64;

export type StyleImageRaster = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

/** MapLibre `StyleImage` RGBA — reliable across MapTiler / Mapbox runtimes. */
export function rasterizeHtmlImageToStyleImage(
  img: CanvasImageSource,
  size = DEFAULT_STYLE_IMAGE_RASTER_SIZE
): StyleImageRaster {
  const width = Math.max(1, Math.floor(size));
  const height = width;
  if (typeof document === 'undefined') {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
  }
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height);
  return { width, height, data: pixels.data };
}

function isSvgStyleImageUrl(url: string): boolean {
  const href = url.trim().toLowerCase();
  return (
    href.startsWith('data:image/svg') ||
    href.includes('image/svg+xml') ||
    /\.svg(?:\?|#|$)/i.test(href)
  );
}

/** MapLibre `loadImage` does not decode SVG data URLs — use `HTMLImageElement` → `addImage`. */
export function decodeHtmlImageAndAdd(
  map: MapStyleImageHost,
  id: string,
  url: string,
  options?: MapStyleImageOptions
): Promise<void> {
  const key = id.trim();
  const href = url.trim();
  if (!key || !href) return Promise.reject(new Error('map style image id and url are required'));
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('HTMLImage decode requires a DOM'));
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const raster = rasterizeHtmlImageToStyleImage(img);
        replaceMapStyleImage(map, key, raster, { pixelRatio: 1, ...options });
        resolve();
      } catch (err) {
        reject(err instanceof Error ? err : new Error('addImage failed'));
      }
    };
    img.onerror = () => reject(new Error('The source image could not be decoded.'));
    img.src = href;
  });
}

/** Replace an existing sprite (e.g. 1×1 placeholder) before registering a real bitmap. */
export function replaceMapStyleImage(
  map: MapStyleImageHost,
  id: string,
  image: unknown,
  options?: MapStyleImageOptions
): void {
  const key = id.trim();
  if (!key || typeof map.addImage !== 'function') return;
  try {
    if (map.hasImage?.(key)) map.removeImage?.(key);
    map.addImage(key, image, options);
  } catch {
    /* style swap / duplicate */
  }
}

/**
 * Idiomatic MapLibre / Mapbox: `map.loadImage(url, (err, image) => map.addImage(id, image))`.
 */
export function loadMapStyleImageAndAdd(
  map: MapStyleImageHost,
  id: string,
  url: string,
  options?: MapStyleImageOptions
): Promise<void> {
  const key = id.trim();
  const href = url.trim();
  if (!key || !href) return Promise.reject(new Error('map style image id and url are required'));
  if (isSvgStyleImageUrl(href)) {
    return decodeHtmlImageAndAdd(map, key, href, options);
  }
  if (typeof map.loadImage !== 'function') {
    return Promise.reject(new Error('map.loadImage is not available'));
  }

  return new Promise((resolve, reject) => {
    map.loadImage!(href, (error, image) => {
      if (error) {
        reject(error);
        return;
      }
      if (!image) {
        reject(new Error('loadImage returned no image'));
        return;
      }
      try {
        if (
          image &&
          typeof image === 'object' &&
          'width' in image &&
          'height' in image &&
          'data' in image
        ) {
          replaceMapStyleImage(map, key, image, { pixelRatio: 1, ...options });
        } else {
          replaceMapStyleImage(map, key, image, options);
        }
        resolve();
      } catch (err) {
        reject(err instanceof Error ? err : new Error('addImage failed'));
      }
    });
  });
}