/**
 * Popup static API (Single Responsibility: create, show, close popups on a map)
 */

import { MapChildElement } from '../../map-child-element';
import { getUIProvider as getGlobalUIProvider } from '../../../providers/registry';
import type { PopupOptions as ProviderPopupOptions } from '../../../providers/types';
import type {
  StyledPopupOptions,
  PointPopupProperties,
  PopupContentOptions,
} from '../../../../types/popup';
import { injectPopupStyles } from './popup-styles';
import {
  buildPopupContent,
  buildPopupContentGeneric,
  addTagsToPopup as addTagsToPopupContent,
} from './popup-content';

export function createPopupWithProvider(provider: any, options: StyledPopupOptions = {}): any {
  injectPopupStyles();
  if (!provider?.createPopup) return null;

  const anchor = options.anchor || 'bottom';
  const offset = options.offset || 25;
  const closeButton = options.closeButton ?? false;

  const popupOptions: ProviderPopupOptions = {
    closeButton,
    closeOnClick: false,
    closeOnMove: false,
    anchor,
    offset,
  };

  return provider.createPopup(popupOptions);
}

export function createPopup(options: StyledPopupOptions = {}): any {
  const provider = getGlobalUIProvider();
  return createPopupWithProvider(provider, options);
}

export function createStyledPopup(options: StyledPopupOptions = {}): any {
  return createPopup(options);
}

export function closeAllPopups(map: any): void {
  if (!map) return;
  try {
    const mapContainer = map.getContainer?.();
    if (mapContainer) {
      const popups = mapContainer.querySelectorAll?.('.maplibregl-popup, .mapboxgl-popup');
      if (popups?.length > 0) {
        popups.forEach((popupEl: HTMLElement) => {
          try {
            const closeButton = popupEl.querySelector?.(
              '.maplibregl-popup-close-button, .mapboxgl-popup-close-button'
            ) as HTMLElement;
            if (closeButton) closeButton.click();
            else popupEl.remove();
          } catch {
            try {
              popupEl.remove();
            } catch {
              // ignore
            }
          }
        });
      }
    }
    if ((map as any)._popups && Array.isArray((map as any)._popups)) {
      const internalPopups = [...(map as any)._popups];
      internalPopups.forEach((popup: any) => {
        try {
          if (popup?.remove) popup.remove();
        } catch {
          // ignore
        }
      });
    }
  } catch {
    // ignore
  }
}

export function determineAnchor(map: any, lngLat: { lng: number; lat: number }): 'top' | 'bottom' {
  if (!map || !lngLat) return 'bottom';
  try {
    const lngLatArray: [number, number] = [lngLat.lng, lngLat.lat];
    const point = map.project(lngLatArray);
    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return 'bottom';
    const estimatedPopupHeight = 80;
    const buffer = 20;
    return point.y < estimatedPopupHeight + buffer ? 'top' : 'bottom';
  } catch {
    return 'bottom';
  }
}

export function stylePopupElement(popupElement: HTMLElement, anchor: 'top' | 'bottom'): void {
  if (!popupElement) return;
  popupElement.setAttribute('data-anchor', anchor);
}

export function showPointPopup(
  popup: any,
  map: any,
  lngLat: { lng: number; lat: number },
  title?: string,
  properties?: PointPopupProperties,
  provider?: any,
  closeButton: boolean = true
): any {
  if (!map || !lngLat) return popup;

  const popupContentEl = buildPopupContent(title, properties);
  if (!popupContentEl) return popup;
  if (!title && !popupContentEl.hasChildNodes()) return popup;

  const activeProvider = provider ?? MapChildElement.getProviderFromMapInstance(map);
  if (!activeProvider?.createPopup) {
    console.error('[PopupElement] No provider available for creating popup');
    return popup;
  }

  closeAllPopups(map);
  if (popup) {
    try {
      popup.remove();
    } catch {
      // ignore
    }
  }

  const anchor = determineAnchor(map, lngLat);
  const offset: [number, number] = anchor === 'bottom' ? [0, -10] : [0, 10];
  const newPopup = createPopupWithProvider(activeProvider, { anchor, offset, closeButton });

  if (!newPopup) {
    console.error('[PopupElement] Failed to create popup instance');
    return null;
  }

  const lng = typeof lngLat.lng === 'number' ? lngLat.lng : parseFloat(String(lngLat.lng));
  const lat = typeof lngLat.lat === 'number' ? lngLat.lat : parseFloat(String(lngLat.lat));
  if (isNaN(lng) || isNaN(lat)) {
    console.error('[PopupElement] Invalid coordinates:', lngLat);
    return null;
  }

  const coordinates: [number, number] = [lng, lat];
  injectPopupStyles();

  try {
    newPopup.setLngLat(coordinates).setDOMContent(popupContentEl).addTo(map);

    if (typeof newPopup.on === 'function') {
      newPopup.on('close', () => {
        const container = map?.getContainer?.();
        const gkMap = container?.closest?.('gk-map');
        const target = (gkMap as HTMLElement) || document;
        target.dispatchEvent(
          new CustomEvent('gk-popup-closed', {
            detail: { popup: newPopup, map },
            bubbles: true,
          })
        );
      });
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          newPopup.setLngLat(coordinates);
          if (map?.triggerRepaint) map.triggerRepaint();
        } catch {
          // ignore
        }
        const popupElement = newPopup.getElement?.();
        if (popupElement) stylePopupElement(popupElement, anchor);
      });
    });

    return newPopup;
  } catch (error) {
    console.error('[PopupElement] Failed to add popup to map:', error);
    return null;
  }
}

export function showPopupGeneric(
  map: any,
  lngLat: { lng: number; lat: number },
  options: PopupContentOptions,
  closeButton: boolean = true
): any {
  if (!map || !lngLat) return null;

  const popupContentEl = buildPopupContentGeneric(options);
  if (!popupContentEl?.hasChildNodes()) return null;

  const activeProvider = MapChildElement.getProviderFromMapInstance(map);
  if (!activeProvider?.createPopup) {
    console.error('[PopupElement] No provider available for creating popup');
    return null;
  }

  closeAllPopups(map);
  const anchor = determineAnchor(map, lngLat);
  const offset: [number, number] = anchor === 'bottom' ? [0, -10] : [0, 10];
  const newPopup = createPopupWithProvider(activeProvider, { anchor, offset, closeButton });

  if (!newPopup) {
    console.error('[PopupElement] Failed to create popup instance');
    return null;
  }

  const lng = typeof lngLat.lng === 'number' ? lngLat.lng : parseFloat(String(lngLat.lng));
  const lat = typeof lngLat.lat === 'number' ? lngLat.lat : parseFloat(String(lngLat.lat));
  if (isNaN(lng) || isNaN(lat)) {
    console.error('[PopupElement] Invalid coordinates:', lngLat);
    return null;
  }

  const coordinates: [number, number] = [lng, lat];
  injectPopupStyles();

  try {
    newPopup.setLngLat(coordinates).setDOMContent(popupContentEl).addTo(map);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          newPopup.setLngLat(coordinates);
          if (map?.triggerRepaint) map.triggerRepaint();
        } catch {
          // ignore
        }
        const popupElement = newPopup.getElement?.();
        if (popupElement) stylePopupElement(popupElement, anchor);
      });
    });

    return newPopup;
  } catch (error) {
    console.error('[PopupElement] Failed to add popup to map:', error);
    return null;
  }
}

export function addTagsToPopup(
  popup: any,
  tags: Array<{ label?: string; value: string } | string>
): void {
  addTagsToPopupContent(popup, tags);
}

export function fadeOutPopup(popup: any, onComplete?: () => void): void {
  if (!popup) {
    onComplete?.();
    return;
  }
  const popupElement = popup.getElement?.();
  if (!popupElement) {
    popup.remove();
    onComplete?.();
    return;
  }
  popupElement.classList.add('geokit-popup-fading');
  setTimeout(() => {
    try {
      popup.remove();
    } catch {
      // ignore
    }
    onComplete?.();
  }, 300);
}

export function closePopup(popup: any): Promise<void> {
  return new Promise((resolve) => {
    if (!popup) {
      resolve();
      return;
    }
    fadeOutPopup(popup, () => resolve());
  });
}
