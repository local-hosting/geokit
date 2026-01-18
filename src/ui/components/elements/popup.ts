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
  address?: string;
  city?: string;
  state?: string;
}

/**
 * A tag with an optional label prefix
 * e.g., { label: 'DMA', value: 'Albuquerque Santa Fe' }
 */
export interface PopupTag {
  /** Optional label prefix (shown in lighter color) */
  label?: string;
  /** Tag value */
  value: string;
}

/**
 * An action link in the popup
 * e.g., { label: 'View Details', href: '/path/123', svg: '<svg>...</svg>' }
 */
export interface PopupAction {
  /** Display text for the link (used as tooltip, or displayed if no icon) */
  label: string;
  /** URL to navigate to */
  href: string;
  /** Optional SVG string for icon button (if not provided, shows label as text link) */
  svg?: string;
  /** Optional CSS class to add to the action link */
  className?: string;
}

/**
 * Generic popup content options for buildPopupContentGeneric
 * Allows apps to customize popup content without hardcoding property names
 */
export interface PopupContentOptions {
  /** Main title/headline */
  headline?: string;
  /** Short badge displayed next to headline (e.g., "A" for cohort) */
  headlineBadge?: string;
  /** Secondary text below headline */
  subhead?: string;
  /** Array of tags to display (string or labeled tag) */
  tags?: (string | PopupTag)[];
  /** Array of action links */
  actions?: PopupAction[];
  /** Footer label displayed at bottom left (e.g., population count) */
  footerLabel?: string;
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
   * Returns true if styles were already injected or successfully injected
   */
  private static injectPopupStyles(): boolean {
    if (PopupElement.stylesInjected) return true;

    if (typeof document === 'undefined') return false;

    const styleId = 'geokit-popup-styles';
    // Remove existing style element to allow HMR updates
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }

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
        padding: 12px 14px;
        border-radius: 6px;
        min-width: 280px;
        max-width: 400px;
        overflow-wrap: break-word;
        word-wrap: break-word;
      }

      /* Utility classes for structured content */
      .geokit-popup-content {
        display: block;
        min-width: 60px;
        max-width: 100%;
        width: 100%;
        box-sizing: border-box;
        overflow-wrap: break-word;
        word-wrap: break-word;
        overflow: hidden;
      }
      
      .geokit-popup-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 4px 0;
        padding-right: 24px;
      }

      h4.geokit-popup-title {
        margin: 0;
        font-weight: 700;
        color: #c9d1d9;
        font-size: 14px;
        line-height: 1.4;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        flex: 1;
      }

      .geokit-popup-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(88, 166, 255, 0.2);
        color: #58a6ff;
        font-size: 11px;
        font-weight: 600;
        border-radius: 4px;
        padding: 2px 6px;
        flex-shrink: 0;
      }

      h5.geokit-popup-address {
        margin: 0 0 8px 0;
        font-size: 12px;
        font-weight: 400;
        color: #8b949e !important;
        line-height: 1.4;
        display: block;
      }

      .geokit-popup-tags {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .geokit-popup-tag {
        display: inline-flex;
        align-items: center;
        background: rgba(139, 148, 158, 0.15);
        color: #c9d1d9;
        font-size: 11px;
        border-radius: 4px;
        padding: 3px 8px;
        gap: 4px;
      }

      .geokit-popup-tag-label {
        color: #6e7681;
        font-weight: 500;
      }

      .geokit-popup-actions {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(139, 148, 158, 0.2);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }

      .geokit-popup-actions-spacer {
        flex: 1;
      }

      .geokit-popup-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        text-decoration: none;
        transition: all 0.15s ease;
        color: #8b949e;
      }

      /* Icon button style (when SVG is provided) */
      .geokit-popup-action--icon {
        width: 28px;
        height: 28px;
        padding: 0;
      }

      .geokit-popup-action--icon:hover {
        background-color: rgba(139, 148, 158, 0.15);
      }

      .geokit-popup-action svg {
        width: 16px;
        height: 16px;
      }

      /* Text link style (fallback when no SVG) */
      .geokit-popup-action--text {
        color: #58a6ff;
        font-size: 12px;
        padding: 4px 8px;
      }

      .geokit-popup-action--text:hover {
        color: #79c0ff;
        text-decoration: underline;
      }

      .geokit-popup-footer-label {
        font-size: 10px;
        font-weight: 600;
        color: #6e7681;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    `;
    document.head.appendChild(style);
    PopupElement.stylesInjected = true;
    return true;
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
    // Use provided offset or MapLibre's standard default (25px)
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

    // Add address if available (below title, above tags)
    // Show city and state only
    if (properties) {
      const parts: string[] = [];
      if (properties.city) parts.push(String(properties.city).trim());
      if (properties.state) parts.push(String(properties.state).trim());

      if (parts.length > 0) {
        const addressText = parts.join(', ');
        const addressEl = document.createElement('h5');
        addressEl.setAttribute('class', 'geokit-popup-address');
        addressEl.textContent = addressText;
        container.appendChild(addressEl);
      }
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
   * Build popup content with generic headline, subhead, and tags
   * Allows consuming apps to fully customize popup content
   */
  public static buildPopupContentGeneric(options: PopupContentOptions): HTMLElement {
    const { headline, headlineBadge, subhead, tags, actions, footerLabel } = options;

    // Create container element using only native DOM APIs
    const container = document.createElement('div');
    container.setAttribute('class', 'geokit-popup-content');

    // Add headline (with optional badge)
    if (headline || headlineBadge) {
      const headerEl = document.createElement('div');
      headerEl.setAttribute('class', 'geokit-popup-header');

      if (headline) {
        const headlineEl = document.createElement('h4');
        headlineEl.setAttribute('class', 'geokit-popup-title');
        headlineEl.textContent = headline;
        headerEl.appendChild(headlineEl);
      }

      if (headlineBadge) {
        const badgeEl = document.createElement('span');
        badgeEl.setAttribute('class', 'geokit-popup-badge');
        badgeEl.textContent = headlineBadge;
        headerEl.appendChild(badgeEl);
      }

      container.appendChild(headerEl);
    }

    // Add subhead
    if (subhead) {
      const subheadEl = document.createElement('h5');
      subheadEl.setAttribute('class', 'geokit-popup-address');
      subheadEl.textContent = subhead;
      container.appendChild(subheadEl);
    }

    // Add tags
    if (tags && tags.length > 0) {
      const tagsContainer = document.createElement('div');
      tagsContainer.setAttribute('class', 'geokit-popup-tags');

      for (const tagItem of tags) {
        if (!tagItem) continue;

        const tagEl = document.createElement('span');
        tagEl.setAttribute('class', 'geokit-popup-tag');

        // Helper to truncate text to max length
        const truncate = (text: string, maxLen: number = 20): string => {
          return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
        };

        if (typeof tagItem === 'string') {
          tagEl.textContent = truncate(tagItem);
          if (tagItem.length > 20) tagEl.setAttribute('title', tagItem);
        } else {
          // Labeled tag: { label: 'DMA', value: 'Albuquerque' }
          if (tagItem.label) {
            const labelEl = document.createElement('span');
            labelEl.setAttribute('class', 'geokit-popup-tag-label');
            labelEl.textContent = tagItem.label;
            tagEl.appendChild(labelEl);
          }
          const truncatedValue = truncate(tagItem.value);
          const valueEl = document.createTextNode(truncatedValue);
          tagEl.appendChild(valueEl);
          if (tagItem.value.length > 20) tagEl.setAttribute('title', tagItem.value);
        }

        tagsContainer.appendChild(tagEl);
      }

      if (tagsContainer.hasChildNodes()) {
        container.appendChild(tagsContainer);
      }
    }

    // Add footer label and action links (on same line)
    if ((actions && actions.length > 0) || footerLabel) {
      const actionsContainer = document.createElement('div');
      actionsContainer.setAttribute('class', 'geokit-popup-actions');

      // Add footer label first (on left)
      if (footerLabel) {
        const labelEl = document.createElement('span');
        labelEl.setAttribute('class', 'geokit-popup-footer-label');
        labelEl.textContent = footerLabel;
        actionsContainer.appendChild(labelEl);

        const spacer = document.createElement('span');
        spacer.setAttribute('class', 'geokit-popup-actions-spacer');
        actionsContainer.appendChild(spacer);
      }

      // Add action links (on right)
      if (actions) {
        for (const action of actions) {
          if (!action || !action.label || !action.href) continue;

          const linkEl = document.createElement('a');
          const baseClass = action.svg
            ? 'geokit-popup-action geokit-popup-action--icon'
            : 'geokit-popup-action geokit-popup-action--text';
          const fullClass = action.className ? `${baseClass} ${action.className}` : baseClass;
          linkEl.setAttribute('class', fullClass);
          linkEl.setAttribute('href', action.href);
          linkEl.setAttribute('target', '_blank');
          linkEl.setAttribute('rel', 'noopener noreferrer');
          linkEl.setAttribute('title', action.label);

          if (action.svg) {
            // Use innerHTML for SVG content (trusted content from app)
            linkEl.innerHTML = action.svg;
          } else {
            linkEl.textContent = action.label;
          }

          actionsContainer.appendChild(linkEl);
        }
      }

      container.appendChild(actionsContainer);
    }

    return container;
  }

  /**
   * Show a popup with generic content (headline, subhead, tags)
   * More flexible than showPointPopup - lets consuming app control all content
   */
  public static showPopupGeneric(
    map: any,
    lngLat: { lng: number; lat: number },
    options: PopupContentOptions,
    closeButton: boolean = true
  ): any {
    if (!map || !lngLat) return null;

    // Build popup content
    const popupContentEl = PopupElement.buildPopupContentGeneric(options);
    if (!popupContentEl || !popupContentEl.hasChildNodes()) return null;

    // Use provider from map instance
    const activeProvider = MapChildElement.getProviderFromMapInstance(map);
    if (!activeProvider || !activeProvider.createPopup) {
      console.error('[PopupElement] No provider available for creating popup');
      return null;
    }

    // Close all existing popups first
    PopupElement.closeAllPopups(map);

    // Determine anchor based on viewport position
    const anchor = PopupElement.determineAnchor(map, lngLat);
    const offset: [number, number] = anchor === 'bottom' ? [0, -10] : [0, 10];

    // Create popup
    const newPopup = PopupElement.createPopupWithProvider(activeProvider, {
      anchor,
      offset,
      closeButton,
    });

    if (!newPopup) {
      console.error('[PopupElement] Failed to create popup instance');
      return null;
    }

    // Validate coordinates
    const lng = typeof lngLat.lng === 'number' ? lngLat.lng : parseFloat(String(lngLat.lng));
    const lat = typeof lngLat.lat === 'number' ? lngLat.lat : parseFloat(String(lngLat.lat));

    if (isNaN(lng) || isNaN(lat)) {
      console.error('[PopupElement] Invalid coordinates:', lngLat);
      return null;
    }

    const coordinates: [number, number] = [lng, lat];

    // Ensure styles are injected
    PopupElement.injectPopupStyles();

    // Add popup to map
    try {
      newPopup.setLngLat(coordinates).setDOMContent(popupContentEl).addTo(map);

      // Reposition after render
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            newPopup.setLngLat(coordinates);
            if (map && typeof (map as any).triggerRepaint === 'function') {
              (map as any).triggerRepaint();
            }
          } catch {
            // Ignore errors if popup was removed
          }

          const popupElement = newPopup.getElement?.();
          if (popupElement) {
            PopupElement.stylePopupElement(popupElement, anchor);
          }
        });
      });

      return newPopup;
    } catch (error) {
      console.error('[PopupElement] Failed to add popup to map:', error);
      return null;
    }
  }

  /**
   * Add tags to an existing popup
   * Useful for adding async data (like demographics) after popup is shown
   *
   * @param popup - The popup instance returned from showPopupGeneric
   * @param tags - Array of tags to add
   */
  public static addTagsToPopup(
    popup: any,
    tags: Array<{ label?: string; value: string } | string>
  ): void {
    if (!popup || !tags || tags.length === 0) return;

    try {
      const popupEl = popup.getElement?.();
      if (!popupEl) return;

      // Find or create the tags container
      let tagsContainer = popupEl.querySelector('.geokit-popup-tags');
      if (!tagsContainer) {
        // Create tags container if it doesn't exist
        const contentEl = popupEl.querySelector('.geokit-popup-content');
        if (!contentEl) return;

        tagsContainer = document.createElement('div');
        tagsContainer.setAttribute('class', 'geokit-popup-tags');

        // Insert before actions if they exist, otherwise append
        const actionsEl = contentEl.querySelector('.geokit-popup-actions');
        if (actionsEl) {
          contentEl.insertBefore(tagsContainer, actionsEl);
        } else {
          contentEl.appendChild(tagsContainer);
        }
      }

      // Add each tag
      for (const tagItem of tags) {
        if (!tagItem) continue;

        const tagEl = document.createElement('span');
        tagEl.setAttribute('class', 'geokit-popup-tag');

        if (typeof tagItem === 'string') {
          tagEl.textContent = tagItem;
        } else {
          if (tagItem.label) {
            const labelEl = document.createElement('span');
            labelEl.setAttribute('class', 'geokit-popup-tag-label');
            labelEl.textContent = tagItem.label + ' ';
            tagEl.appendChild(labelEl);

            const valueEl = document.createElement('span');
            valueEl.setAttribute('class', 'geokit-popup-tag-value');
            valueEl.textContent = tagItem.value;
            tagEl.appendChild(valueEl);
          } else {
            tagEl.textContent = tagItem.value;
          }
        }

        tagsContainer.appendChild(tagEl);
      }
    } catch (error) {
      console.warn('[PopupElement] Failed to add tags to popup:', error);
    }
  }

  /**
   * Close all popups on a map instance
   */
  public static closeAllPopups(map: any): void {
    if (!map) return;

    try {
      // Find all popup elements in the map container
      const mapContainer = map.getContainer?.();
      if (mapContainer) {
        // Query for both MapLibre and Mapbox popup classes
        const popups = mapContainer.querySelectorAll?.('.maplibregl-popup, .mapboxgl-popup');
        if (popups && popups.length > 0) {
          popups.forEach((popupEl: HTMLElement) => {
            try {
              // Try to find and click the close button first (proper way)
              const closeButton = popupEl.querySelector?.(
                '.maplibregl-popup-close-button, .mapboxgl-popup-close-button'
              ) as HTMLElement;
              if (closeButton) {
                closeButton.click();
              } else {
                // Fallback: remove the popup element directly from DOM
                popupEl.remove();
              }
            } catch {
              // If clicking fails, try direct removal
              try {
                popupEl.remove();
              } catch {
                // Ignore removal errors
              }
            }
          });
        }
      }

      // Also try to access MapLibre's internal popup tracking if available
      // MapLibre stores popups in _popups array on the map instance
      if ((map as any)._popups && Array.isArray((map as any)._popups)) {
        const internalPopups = [...(map as any)._popups];
        internalPopups.forEach((popup: any) => {
          try {
            if (popup && typeof popup.remove === 'function') {
              popup.remove();
            }
          } catch {
            // Ignore errors
          }
        });
      }
    } catch {
      // Silently handle errors - popups might already be removed
    }
  }

  /**
   * Determine the best anchor position based on viewport
   */
  public static determineAnchor(map: any, lngLat: { lng: number; lat: number }): 'top' | 'bottom' {
    if (!map || !lngLat) return 'bottom';

    try {
      // Convert lngLat object to array format [lng, lat] for MapLibre/MapTiler
      const lngLatArray: [number, number] = [lngLat.lng, lngLat.lat];
      const point = map.project(lngLatArray);

      if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
        return 'bottom';
      }

      const estimatedPopupHeight = 80;
      const buffer = 20;

      if (point.y < estimatedPopupHeight + buffer) {
        return 'top';
      }

      return 'bottom';
    } catch {
      // Fallback to bottom if projection fails
      return 'bottom';
    }
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

    // Always close ALL existing popups on the map first
    // This ensures only one popup is visible at a time
    PopupElement.closeAllPopups(map);

    // Also remove the specific popup if provided
    if (popup) {
      try {
        popup.remove();
      } catch {
        // Ignore errors if popup already removed
      }
    }

    // Determine anchor based on viewport position
    const anchor = PopupElement.determineAnchor(map, lngLat);
    // Use minimal offset to position popup directly above/below the point
    // The offset accounts for the popup tip height (~10px) so the tip points to the exact coordinate
    const offset: [number, number] = anchor === 'bottom' ? [0, -10] : [0, 10];

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
    // Ensure coordinates are valid numbers
    const lng = typeof lngLat.lng === 'number' ? lngLat.lng : parseFloat(String(lngLat.lng));
    const lat = typeof lngLat.lat === 'number' ? lngLat.lat : parseFloat(String(lngLat.lat));

    if (isNaN(lng) || isNaN(lat)) {
      console.error('[PopupElement] Invalid coordinates:', lngLat);
      return null;
    }

    const coordinates: [number, number] = [lng, lat];

    // Ensure styles are injected before adding popup to map
    // This is critical for proper positioning on first render
    // Styles are also injected in createPopupWithProvider, but we ensure they're ready here
    PopupElement.injectPopupStyles();

    // Add popup to map following MapLibre's documented pattern:
    // new Popup().setLngLat(coordinates).setHTML/setDOMContent(content).addTo(map)
    try {
      newPopup.setLngLat(coordinates).setDOMContent(popupContentEl).addTo(map);

      // Wait for map to finish rendering and styles to be applied
      // Use requestAnimationFrame to ensure we're after the render cycle
      // This fixes the issue where popup doesn't position correctly until map rotates
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Re-set the coordinates to trigger proper positioning after render
          // This ensures the popup tip points correctly to the marker from the start
          try {
            // Force a reposition by setting coordinates again
            // This is necessary because MapLibre may not position correctly on first render
            newPopup.setLngLat(coordinates);

            // Also trigger a repaint to ensure the popup is positioned correctly
            if (map && typeof (map as any).triggerRepaint === 'function') {
              (map as any).triggerRepaint();
            }
          } catch {
            // Ignore errors if popup was removed
          }

          // Style popup element after it's positioned
          const popupElement = newPopup.getElement?.();
          if (popupElement) {
            PopupElement.stylePopupElement(popupElement, anchor);
          }
        });
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

  /**
   * Close popup with a Promise that resolves when animation completes
   */
  public static closePopup(popup: any): Promise<void> {
    return new Promise((resolve) => {
      if (!popup) {
        resolve();
        return;
      }
      PopupElement.fadeOutPopup(popup, () => resolve());
    });
  }
}

// ============================================================================
// Cross-Map Popup Coordination
// ============================================================================

const CLEAR_POPUPS_EVENT = 'gk-clear-all-popups';

/**
 * Dispatch event to close popups in other map instances
 * Used for coordinating popups across multiple maps (e.g., in a grid/collection)
 *
 * @param sourceId - Optional identifier for the source map (e.g., market slug)
 *                   Other maps can use this to avoid closing their own popup
 */
export function dispatchClearPopupsEvent(sourceId?: string): void {
  if (typeof document === 'undefined') return;

  document.dispatchEvent(
    new CustomEvent(CLEAR_POPUPS_EVENT, {
      detail: { sourceId },
    })
  );
}

/**
 * Subscribe to popup clear events from other maps
 * Returns an unsubscribe function
 *
 * @param sourceId - This map's identifier (won't trigger callback for own events)
 * @param onClear - Callback to invoke when another map requests popup clearing
 * @returns Unsubscribe function to remove the listener
 *
 * @example
 * const unsubscribe = onClearPopupsEvent('my-market', () => {
 *   closeMyPopup();
 * });
 * // Later: unsubscribe();
 */
export function onClearPopupsEvent(sourceId: string, onClear: () => void): () => void {
  if (typeof document === 'undefined') return () => {};

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent;
    const eventSourceId = customEvent.detail?.sourceId;

    // Don't trigger for our own events
    if (eventSourceId === sourceId) return;

    onClear();
  };

  document.addEventListener(CLEAR_POPUPS_EVENT, handler);

  // Return unsubscribe function
  return () => {
    document.removeEventListener(CLEAR_POPUPS_EVENT, handler);
  };
}

// Register the custom element
if (!customElements.get('gk-popup')) {
  customElements.define('gk-popup', PopupElement);
}
