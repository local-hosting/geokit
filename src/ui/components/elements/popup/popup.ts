/**
 * Geokit Popup Component
 *
 * Creates styled popups for displaying information on maps.
 * Works with both MapTiler (MapLibre GL JS) and Mapbox GL JS providers.
 *
 * Usage:
 * <gk-popup lat="40.7128" lng="-74.0060" content="Hello World"></gk-popup>
 *
 * Or use static methods for programmatic popup creation:
 * PopupElement.createPopup({ anchor: 'bottom' })
 * PopupElement.showPointPopup(popup, map, lngLat, title, properties)
 */

import { MapChildElement } from '../../map-child-element';
import type { PopupOptions as ProviderPopupOptions } from '../../../providers/types';
import type {
  StyledPopupOptions,
  PointPopupProperties,
  PopupContentOptions,
} from '../../../../types/popup';
import { injectPopupStyles } from './popup-styles';
import { buildPopupContent, buildPopupContentGeneric } from './popup-content';
import {
  createPopupWithProvider,
  createPopup as createPopupApi,
  createStyledPopup as createStyledPopupApi,
  closeAllPopups,
  determineAnchor,
  stylePopupElement,
  showPointPopup as showPointPopupApi,
  showPopupGeneric as showPopupGenericApi,
  addTagsToPopup as addTagsToPopupApi,
  fadeOutPopup as fadeOutPopupApi,
  closePopup as closePopupApi,
} from './popup-api';

// Re-export types for consumers that import from this file
export type {
  PopupOptions,
  StyledPopupOptions,
  PointPopupProperties,
  PopupTag,
  PopupAction,
  PopupContentOptions,
} from '../../../../types/popup';

export class PopupElement extends MapChildElement {
  static observedAttributes = ['lat', 'lng', 'content', 'anchor', 'offset', 'close-button'];

  private popupInstance: any = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected override async onMapReady(): Promise<void> {
    await super.onMapReady();
    this.showPopup();
  }

  protected override onStyleLoad(): void {
    if (!this.map) return;
    this.showPopup();
  }

  private showPopup(): void {
    if (!this.map) return;

    injectPopupStyles();

    const lat = parseFloat(this.getAttribute('lat') || '');
    const lng = parseFloat(this.getAttribute('lng') || '');

    if (isNaN(lat) || isNaN(lng)) {
      console.warn('[gk-popup] Invalid lat/lng coordinates');
      return;
    }

    const content = this.getAttribute('content') || '';
    const anchor = this.getAttribute('anchor') || 'bottom';
    const closeButton = this.getAttribute('close-button') === 'true';

    this.removePopup();

    try {
      const provider = this.getUIProvider();
      const offset = this.getAttribute('offset');
      const offsetValue: number | [number, number] = offset ? parseInt(offset, 10) : 25;

      const options: ProviderPopupOptions = {
        anchor: anchor as 'center' | 'top' | 'bottom' | 'left' | 'right',
        closeButton,
        closeOnClick: false,
        closeOnMove: false,
        offset: offsetValue,
      };

      this.popupInstance = provider.createPopup(options);

      if (this.popupInstance) {
        this.popupInstance.setLngLat([lng, lat]).setHTML(content).addTo(this.map);

        requestAnimationFrame(() => {
          const popupElement = this.popupInstance?.getElement?.();
          if (popupElement) {
            stylePopupElement(popupElement, anchor as 'top' | 'bottom');
          }
        });

        this.dispatchEvent(
          new CustomEvent('popup-opened', {
            detail: { lat, lng, content, element: this },
            bubbles: true,
          })
        );
      }
    } catch (error) {
      console.error('[gk-popup] Failed to create popup:', error);
    }
  }

  private removePopup(): void {
    if (this.popupInstance) {
      this.popupInstance.remove();
      this.popupInstance = null;
    }
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (this.isInitialized && oldValue !== newValue) {
      this.showPopup();
    }
  }

  override disconnectedCallback(): void {
    this.removePopup();
    super.disconnectedCallback();
  }

  public open(): void {
    this.showPopup();
  }

  public close(): void {
    this.removePopup();
  }

  public setContent(content: string): void {
    this.setAttribute('content', content);
  }

  public setPosition(lat: number, lng: number): void {
    this.setAttribute('lat', lat.toString());
    this.setAttribute('lng', lng.toString());
  }

  // --- Static API (delegate to popup-api and popup-content) ---

  public static injectPopupStyles(): boolean {
    return injectPopupStyles();
  }

  public static createPopupWithProvider(provider: any, options: StyledPopupOptions = {}): any {
    return createPopupWithProvider(provider, options);
  }

  public static createPopup(options: StyledPopupOptions = {}): any {
    return createPopupApi(options);
  }

  public static createStyledPopup(options: StyledPopupOptions = {}): any {
    return createStyledPopupApi(options);
  }

  public static buildPopupContent(title?: string, properties?: PointPopupProperties): HTMLElement {
    return buildPopupContent(title, properties);
  }

  public static buildPopupContentGeneric(options: PopupContentOptions): HTMLElement {
    return buildPopupContentGeneric(options);
  }

  public static showPopupGeneric(
    map: any,
    lngLat: { lng: number; lat: number },
    options: PopupContentOptions,
    closeButton: boolean = true
  ): any {
    return showPopupGenericApi(map, lngLat, options, closeButton);
  }

  public static addTagsToPopup(
    popup: any,
    tags: Array<{ label?: string; value: string } | string>
  ): void {
    addTagsToPopupApi(popup, tags);
  }

  public static closeAllPopups(map: any): void {
    closeAllPopups(map);
  }

  public static determineAnchor(map: any, lngLat: { lng: number; lat: number }): 'top' | 'bottom' {
    return determineAnchor(map, lngLat);
  }

  public static stylePopupElement(popupElement: HTMLElement, anchor: 'top' | 'bottom'): void {
    stylePopupElement(popupElement, anchor);
  }

  public static showPointPopup(
    popup: any,
    map: any,
    lngLat: { lng: number; lat: number },
    title?: string,
    properties?: PointPopupProperties,
    provider?: any,
    closeButton: boolean = true
  ): any {
    return showPointPopupApi(popup, map, lngLat, title, properties, provider, closeButton);
  }

  public static fadeOutPopup(popup: any, onComplete?: () => void): void {
    fadeOutPopupApi(popup, onComplete);
  }

  public static closePopup(popup: any): Promise<void> {
    return closePopupApi(popup);
  }
}

// ============================================================================
// Cross-Map Popup Coordination
// ============================================================================

const CLEAR_POPUPS_EVENT = 'gk-clear-all-popups';

export function dispatchClearPopupsEvent(sourceId?: string): void {
  if (typeof document === 'undefined') return;

  document.dispatchEvent(
    new CustomEvent(CLEAR_POPUPS_EVENT, {
      detail: { sourceId },
    })
  );
}

export function onClearPopupsEvent(sourceId: string, onClear: () => void): () => void {
  if (typeof document === 'undefined') return () => {};

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent;
    const eventSourceId = customEvent.detail?.sourceId;

    if (eventSourceId === sourceId) return;

    onClear();
  };

  document.addEventListener(CLEAR_POPUPS_EVENT, handler);

  return () => {
    document.removeEventListener(CLEAR_POPUPS_EVENT, handler);
  };
}

if (!customElements.get('gk-popup')) {
  customElements.define('gk-popup', PopupElement);
}
