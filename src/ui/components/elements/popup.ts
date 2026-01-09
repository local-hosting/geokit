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

import { MapChildElement } from '../map-child-element';
import { getUIProvider as getGlobalUIProvider } from '../../providers/registry';
import type { PopupOptions as ProviderPopupOptions } from '../../providers/types';

export interface PopupOptions {
  lat: number;
  lng: number;
  content?: string;
  anchor?: string;
  offset?: number;
  closeButton?: boolean;
}

export interface StyledPopupOptions {
  anchor?: 'top' | 'bottom';
  offset?: number | [number, number];
  closeButton?: boolean;
}

export interface PointPopupProperties {
  [key: string]: any;
  'id:google-maps'?: string;
  'id:store-sid'?: string;
  'id:store-number'?: string;
  id?: string;
}

export class PopupElement extends MapChildElement {
  static observedAttributes = ['lat', 'lng', 'content', 'anchor', 'offset', 'close-button'];

  private popupInstance: any = null;
  private static stylesInjected = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  /**
   * Inject styled popup CSS styles (called automatically on first use)
   */
  private static injectPopupStyles(): void {
    if (PopupElement.stylesInjected) return;

    const styleId = 'geokit-popup-styles';
    if (typeof document !== 'undefined' && document.getElementById(styleId)) {
      PopupElement.stylesInjected = true;
      return;
    }

    if (typeof document === 'undefined') return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Geokit Popup Styles */
      /* Essential positioning fix + dark theme colors */
      
      /* CRITICAL: Fix canvas container position (MapLibre sometimes offsets it) */
      .maplibregl-canvas-container {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
      }
      
      /* Ensure popup is above canvas */
      .maplibregl-popup {
        z-index: 10;
      }
      
      /* Fade-out animation */
      .maplibregl-popup {
        transition: opacity 0.3s ease-out;
      }
      
      .maplibregl-popup.geokit-popup-fading {
        opacity: 0;
      }

      /* Dark theme background and text color */
      .maplibregl-popup-content {
        background: rgb(22, 27, 34) !important;
        color: #c9d1d9 !important;
      }

      /* Dark theme tip color - match background for all anchor positions */
      .maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
        border-top-color: rgb(22, 27, 34) !important;
      }

      .maplibregl-popup-anchor-top .maplibregl-popup-tip {
        border-bottom-color: rgb(22, 27, 34) !important;
      }

      .maplibregl-popup-anchor-left .maplibregl-popup-tip {
        border-right-color: rgb(22, 27, 34) !important;
      }

      .maplibregl-popup-anchor-right .maplibregl-popup-tip {
        border-left-color: rgb(22, 27, 34) !important;
      }

      .maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip,
      .maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip {
        border-top-color: rgb(22, 27, 34) !important;
      }

      .maplibregl-popup-anchor-top-left .maplibregl-popup-tip,
      .maplibregl-popup-anchor-top-right .maplibregl-popup-tip {
        border-bottom-color: rgb(22, 27, 34) !important;
      }

      /* Close button styling - ensure proper positioning and visibility */
      .maplibregl-popup-close-button,
      .mapboxgl-popup-close-button {
        position: absolute;
        top: 4px;
        right: 4px;
        padding: 4px 8px;
        font-size: 18px;
        line-height: 1;
        color: #8b949e;
        background: transparent;
        border: none;
        cursor: pointer;
        z-index: 1;
      }

      .maplibregl-popup-close-button:hover,
      .mapboxgl-popup-close-button:hover {
        color: #c9d1d9;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
      }
      
      /* Ensure popup content has padding for close button */
      .maplibregl-popup-content,
      .mapboxgl-popup-content {
        position: relative;
        padding: 12px 32px 12px 14px;
        border-radius: 6px;
      }

      /* Utility classes for structured content */
      h4.geokit-popup-title {
        margin: 0 0 4px 0;
        font-weight: 700;
        color: #c9d1d9;
        font-size: 14px;
      }

      .geokit-popup-tags {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .geokit-popup-tag {
        display: inline-block;
        background: rgba(139, 148, 158, 0.15);
        color: #8b949e;
        font-size: 11px;
        border-radius: 4px;
        padding: 3px 8px;
      }
    `;
    document.head.appendChild(style);
    PopupElement.stylesInjected = true;
  }

  protected override async onMapReady(): Promise<void> {
    await super.onMapReady();
    this.showPopup();
  }

  private showPopup(): void {
    if (!this.map) return;

    // Inject styles on first use
    PopupElement.injectPopupStyles();

    const lat = parseFloat(this.getAttribute('lat') || '');
    const lng = parseFloat(this.getAttribute('lng') || '');

    if (isNaN(lat) || isNaN(lng)) {
      console.warn('Popup: Invalid lat/lng coordinates');
      return;
    }

    const content = this.getAttribute('content') || '';
    const anchor = this.getAttribute('anchor') || 'bottom';
    const closeButton = this.getAttribute('close-button') === 'true';

    // Remove existing popup
    this.removePopup();

    try {
      const provider = this.getUIProvider();
      const offset = this.getAttribute('offset');
      // Standard MapLibre offset (25px)
      const offsetValue: number | [number, number] = offset ? parseInt(offset) : 25;

      const options: ProviderPopupOptions = {
        anchor: anchor as 'center' | 'top' | 'bottom' | 'left' | 'right',
        closeButton,
        closeOnClick: false, // Don't auto-close on click - we handle this ourselves
        closeOnMove: false,
        offset: offsetValue,
      };

      this.popupInstance = provider.createPopup(options);

      if (this.popupInstance) {
        // For gk-popup element, HTML content is allowed since it's a native custom element
        // (not affected by Vue's template parsing like programmatic popups)
        this.popupInstance.setLngLat([lng, lat]).setHTML(content).addTo(this.map);

        // Style the popup element after it's added
        requestAnimationFrame(() => {
          const popupElement = this.popupInstance?.getElement?.();
          if (popupElement) {
            PopupElement.stylePopupElement(popupElement, anchor as 'top' | 'bottom');
          }
        });

        // Dispatch event
        this.dispatchEvent(
          new CustomEvent('popup-opened', {
            detail: { lat, lng, content, element: this },
            bubbles: true,
          })
        );
      }
    } catch (error) {
      console.error('Failed to create popup:', error);
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

  // Public API
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

  /**
   * Create a popup instance with a specific provider
   */
  private static createPopupWithProvider(provider: any, options: StyledPopupOptions = {}): any {
    PopupElement.injectPopupStyles();

    if (!provider || !provider.createPopup) return null;

    const anchor = options.anchor || 'bottom';
    // Offset accounts for the tip height (10px) plus some spacing
    // Standard MapLibre offset (25px)
    const offset = options.offset || 25;
    const closeButton = options.closeButton ?? false;

    const popupOptions: ProviderPopupOptions = {
      closeButton,
      closeOnClick: false, // Don't auto-close on click - we handle this ourselves
      closeOnMove: false,
      anchor,
      offset,
    };

    return provider.createPopup(popupOptions);
  }

  /**
   * Create a popup instance (all popups are styled by default)
   */
  public static createPopup(options: StyledPopupOptions = {}): any {
    // For static methods, we need to get the provider from the registry
    // This assumes a default provider has been set
    const provider = getGlobalUIProvider();
    return PopupElement.createPopupWithProvider(provider, options);
  }

  /**
   * @deprecated Use createPopup() instead. All popups are styled by default.
   */
  public static createStyledPopup(options: StyledPopupOptions = {}): any {
    return PopupElement.createPopup(options);
  }

  /**
   * Build popup content DOM element with title and ID tags
   * Creates a completely isolated DOM element that's safe from Vue's reactivity system
   * Uses only native DOM APIs - no innerHTML or HTML strings
   */
  public static buildPopupContent(title?: string, properties?: PointPopupProperties): HTMLElement {
    // Create container element using only native DOM APIs
    const container = document.createElement('div');
    // Use setAttribute instead of className to be extra safe
    container.setAttribute('class', 'geokit-popup-content');

    if (title) {
      const titleEl = document.createElement('h4');
      titleEl.setAttribute('class', 'geokit-popup-title');
      // Use textContent to ensure no HTML parsing happens
      titleEl.textContent = title;
      container.appendChild(titleEl);
    }

    // Create container for ID tags
    if (properties) {
      const tagsContainer = document.createElement('div');
      tagsContainer.setAttribute('class', 'geokit-popup-tags');
      let hasTags = false;

      if (properties?.['id:google-maps']) {
        const tag = document.createElement('span');
        tag.setAttribute('class', 'geokit-popup-tag');
        tag.textContent = properties['id:google-maps'];
        tagsContainer.appendChild(tag);
        hasTags = true;
      }

      if (properties?.['id:store-sid']) {
        const tag = document.createElement('span');
        tag.setAttribute('class', 'geokit-popup-tag');
        tag.textContent = properties['id:store-sid'];
        tagsContainer.appendChild(tag);
        hasTags = true;
      }

      if (properties?.['id:store-number']) {
        const tag = document.createElement('span');
        tag.setAttribute('class', 'geokit-popup-tag');
        tag.textContent = properties['id:store-number'];
        tagsContainer.appendChild(tag);
        hasTags = true;
      }

      // Fallback to old 'id' field if no new ID types exist
      if (!hasTags && properties?.id) {
        const tag = document.createElement('span');
        tag.setAttribute('class', 'geokit-popup-tag');
        tag.textContent = properties.id;
        tagsContainer.appendChild(tag);
        hasTags = true;
      }

      if (hasTags) {
        container.appendChild(tagsContainer);
      }
    }

    // Return the element directly - it's already isolated since we used only native DOM APIs
    return container;
  }

  /**
   * Determine the best anchor position based on viewport
   */
  public static determineAnchor(map: any, lngLat: { lng: number; lat: number }): 'top' | 'bottom' {
    if (!map || !lngLat) return 'bottom';

    // Convert lngLat object to array format [lng, lat] for MapLibre/MapTiler
    const lngLatArray: [number, number] = [lngLat.lng, lngLat.lat];
    const point = map.project(lngLatArray);
    const estimatedPopupHeight = 80;
    const buffer = 20;

    if (point.y < estimatedPopupHeight + buffer) {
      return 'top';
    }

    return 'bottom';
  }

  /**
   * Style the popup element after it's added to the map
   */
  public static stylePopupElement(popupElement: HTMLElement, anchor: 'top' | 'bottom'): void {
    if (!popupElement) return;

    // Set anchor attribute for CSS targeting
    popupElement.setAttribute('data-anchor', anchor);
  }

  /**
   * Show a styled popup with point information
   * Following MapLibre documentation: always create a new popup for each click
   * See: https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup/
   */
  public static showPointPopup(
    popup: any,
    map: any,
    lngLat: { lng: number; lat: number },
    title?: string,
    properties?: PointPopupProperties,
    provider?: any,
    closeButton: boolean = true
  ): any {
    if (!map || !lngLat) return popup;

    // Build popup content
    const popupContentEl = PopupElement.buildPopupContent(title, properties);
    if (!popupContentEl) return popup;

    // If no title and no content, don't show popup
    if (!title && !popupContentEl.hasChildNodes()) return popup;

    // Use provided provider, or automatically find it from the parent map element
    const activeProvider = provider || MapChildElement.getProviderFromMapInstance(map);
    if (!activeProvider || !activeProvider.createPopup) {
      console.error('[PopupElement] No provider available for creating popup');
      return popup;
    }

    // Always remove existing popup first (per MapLibre best practice)
    if (popup) {
      try {
        popup.remove();
      } catch {
        // Ignore errors if popup already removed
      }
    }

    // Determine anchor based on viewport position
    const anchor = PopupElement.determineAnchor(map, lngLat);
    // Standard MapLibre offset (25px) positions popup above the marker
    const offset = 25;

    // Create a fresh popup (per MapLibre documentation pattern)
    const newPopup = PopupElement.createPopupWithProvider(activeProvider, {
      anchor,
      offset,
      closeButton,
    });

    if (!newPopup) {
      console.error('[PopupElement] Failed to create popup instance');
      return null;
    }

    // Convert lngLat to array format [lng, lat] as required by MapLibre
    // Use .slice() as recommended in MapLibre docs to create a copy
    const coordinates: [number, number] = [lngLat.lng, lngLat.lat];

    // Add popup to map following MapLibre's documented pattern:
    // new Popup().setLngLat(coordinates).setHTML/setDOMContent(content).addTo(map)
    try {
      newPopup.setLngLat(coordinates).setDOMContent(popupContentEl).addTo(map);

      // Style popup element after it's added
      requestAnimationFrame(() => {
        const popupElement = newPopup.getElement?.();
        if (popupElement) {
          PopupElement.stylePopupElement(popupElement, anchor);
        }
      });

      return newPopup;
    } catch (error) {
      console.error('[PopupElement] Failed to add popup to map:', error);
      return null;
    }
  }

  /**
   * Fade out and remove a popup with animation
   */
  public static fadeOutPopup(popup: any, onComplete?: () => void): void {
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

    // Add fading class to trigger CSS animation
    popupElement.classList.add('geokit-popup-fading');

    // Remove popup after animation completes
    setTimeout(() => {
      try {
        popup.remove();
      } catch {
        // Popup may already be removed
      }
      onComplete?.();
    }, 300); // Match CSS transition duration
  }
}

// Register the custom element
if (!customElements.get('gk-popup')) {
  customElements.define('gk-popup', PopupElement);
}
