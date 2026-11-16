/**
 * Map style validation and style-image-missing (Single Responsibility)
 */

type MapStyleLike = {
  setStyle?: (style: string | object, options?: object) => void;
  getStyle?: () => { name?: string } | string | undefined;
  isStyleLoaded?: () => boolean;
  once?: (event: string, fn: () => void) => void;
  on?: (event: string, fn: (e: { id: string }) => void) => void;
  addImage?: (
    id: string,
    image: { width: number; height: number; data: Uint8ClampedArray }
  ) => void;
  hasImage?: (id: string) => boolean;
};

import { buildMaptilerStyleUrl } from '@twinfile/geokit/ui/config/tile-cdn';
import { isReservedMapStyleImageId } from '../../../../utils/map-surface/map-style-images';
import { mapStyleSwapOptions } from './preserve-custom-style-overlays';

const defaultStyleUrl = (apiKey: string) => buildMaptilerStyleUrl('dataviz-dark', apiKey);

/**
 * Check current style and replace if deprecated/invalid. Safe to call repeatedly.
 */
export function checkAndUpdateStyle(
  map: MapStyleLike | null,
  apiKey: string,
  provider = 'maptiler'
): void {
  if (provider !== 'maptiler') return;
  if (!map?.setStyle || typeof map.setStyle !== 'function') return;
  if (!apiKey) return;

  try {
    const currentStyle = map.getStyle?.();
    let needsReplacement = false;

    if (currentStyle) {
      if (typeof currentStyle === 'string' && currentStyle.startsWith('http')) {
        needsReplacement = false;
      } else if (typeof currentStyle === 'object' && currentStyle.name === 'Streets Default v2') {
        needsReplacement = true;
      } else if (typeof currentStyle === 'string' && currentStyle.includes('streets-v2')) {
        needsReplacement = true;
      } else if (typeof currentStyle === 'string' && !currentStyle.includes('api.maptiler.com')) {
        needsReplacement = true;
      }
    } else {
      needsReplacement = true;
    }

    if (!needsReplacement) return;

    const validStyle = defaultStyleUrl(apiKey);
    const swapOpts = mapStyleSwapOptions();
    if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) {
      map.once?.('load', () => {
        try {
          if (map.isStyleLoaded?.()) {
            map.setStyle?.(validStyle, swapOpts);
          }
        } catch {
          // ignore
        }
      });
      return;
    }
    try {
      map.setStyle(validStyle, swapOpts);
    } catch {
      // ignore
    }
  } catch {
    // non-critical
  }
}

/**
 * Ensure valid style after load: wait for load then run checkAndUpdateStyle.
 */
export function ensureValidMapStyleAfterLoad(
  map: MapStyleLike | null,
  apiKey: string,
  onCheckAndUpdate: () => void
): void {
  if (!map?.setStyle || typeof map.setStyle !== 'function') return;

  const checkAndSet = () => {
    setTimeout(() => {
      onCheckAndUpdate();
    }, 0);
  };

  if (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) {
    checkAndSet();
  } else {
    map.once?.('load', checkAndSet);
  }
}

/**
 * Create handler for styleimagemissing (1x1 transparent placeholder). Caller attaches to map and stores handler for teardown.
 */
export function createStyleImageMissingHandler(
  map: MapStyleLike | null
): ((e: { id: string }) => void) | null {
  if (!map?.on || typeof map.addImage !== 'function') return null;

  const size = 1;
  const data = new Uint8ClampedArray(size * size * 4);
  const placeholder = { width: size, height: size, data };

  return (e: { id: string }) => {
    const id = e?.id;
    if (id == null) return;
    if (isReservedMapStyleImageId(id)) return;
    try {
      if (!map.hasImage?.(id)) {
        map.addImage?.(id, placeholder);
      }
    } catch {
      // ignore
    }
  };
}
