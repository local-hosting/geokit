/**
 * Map Component
 *
 * Main map container component
 *
 * Usage:
 * <mapi-map lat="40.7128" lng="-74.006" zoom="10" style="streets"></mapi-map>
 */

import { BaseElement } from '../base-element';
import { registerUIProvider } from '../../providers/registry';
import { MapTilerUIProvider } from '../../providers/maptiler-provider';
import { PointElement } from './point';
import { PolygonElement } from './polygon';
import type { MapInstance } from '../../providers/types';

export class MapElement extends BaseElement {
  static observedAttributes = [
    'lat',
    'lng',
    'zoom',
    'min-zoom',
    'max-zoom',
    'style',
    'pitch',
    'bearing',
    'interactive',
    'hide-controls',
    'auto-hide-controls',
    'show-attribution',
    'provider',
  ];

  private _controlsVisible: boolean = true;
  private _mouseEnterHandler: (() => void) | null = null;
  private _mouseLeaveHandler: (() => void) | null = null;
  private _isFrozen: boolean = false;
  private _isUnfreezing: boolean = false; // Prevent race conditions
  private _isInitializing: boolean = false; // Prevent concurrent initialization
  private _frozenContainerStyle: { display?: string; visibility?: string } | null = null;
  private _mapCanvas: HTMLCanvasElement | null = null;

  constructor() {
    super();
    this.map = null;
    this.isInitialized = false;

    // Set display properties for custom element
    if (!this.style.display || this.style.display === 'inline') {
      this.style.display = 'block';
    }
    if (!this.style.width) {
      this.style.width = '100%';
    }
    if (!this.style.height) {
      this.style.height = '100%';
    }
    if (!this.style.position || this.style.position === 'static') {
      this.style.position = 'relative';
    }
  }

  async connectedCallback(): Promise<void> {
    // Show placeholder if map is not initialized
    this.showPlaceholderIfNeeded();

    // If map is pool-managed (has data-pool-managed attribute), don't auto-initialize
    // It will be initialized explicitly via activateMap()
    if (this.hasAttribute('data-pool-managed')) {
      return;
    }

    // If inside a gk-map-collection, defer initialization to the collection
    // The collection will manage pool and set proper attributes before initializing
    const parentCollection = this.closest('gk-map-collection');
    if (parentCollection) {
      // Mark as pool-managed so we don't try again
      this.setAttribute('data-pool-managed', 'true');
      return;
    }

    // Prevent re-initialization if map already exists (important for map pool reuse)
    // When maps are moved between cards, connectedCallback can be called again,
    // but we should reuse the existing map instance to avoid creating new WebGL contexts
    if (!this.isInitialized && !this.map) {
      await this.initializeMap();
    } else if (this.map && !this.isInitialized) {
      // Map exists but not marked as initialized - mark it as initialized
      // This can happen if the map was created but the load event hasn't fired yet
      this.isInitialized = true;
      this.hidePlaceholder();
    }
  }

  /**
   * Override disconnectedCallback to preserve map instance when element is moved
   * This is critical for map pool reuse - we don't want to destroy the map instance
   * when the element is moved between cards, only when it's permanently removed
   *
   * For map pool reuse, we preserve the map instance so it can be reused.
   * The map will only be cleaned up if explicitly removed via remove() or similar.
   */
  disconnectedCallback(): void {
    // Clean up auto-hide listeners
    this.cleanupAutoHideControls();

    // Don't call super.disconnectedCallback() because it resets this.map = null
    // We want to preserve the map instance for reuse in the map pool
    // Only clean up if we have a flag indicating permanent removal
    // For now, we preserve the map instance - it will be cleaned up
    // when the element is actually removed from the DOM permanently
    // (which doesn't happen in map pool reuse scenarios)
  }

  async initializeMap(): Promise<void> {
    // Prevent concurrent initialization
    if (this._isInitializing) {
      console.warn('[gk-map] Already initializing, skipping duplicate call');
      return;
    }

    this._isInitializing = true;

    try {
      // Get provider name from attribute or try auto-detection
      const providerName = this.getAttribute('provider');
      const apiKey = this.getAttribute('api-key');
      const accessToken = this.getAttribute('access-token');

      let provider;

      // If provider is explicitly specified, use it
      if (providerName) {
        const { getProviderByName, registerUIProvider } = await import('../../providers/registry');
        const existingProvider = await getProviderByName(providerName).catch(() => null);

        // Always load CSS for the provider (even if already registered)
        if (providerName === 'maptiler') {
          await import('@maptiler/sdk/dist/maptiler-sdk.css');
        } else if (providerName === 'mapbox') {
          await import('mapbox-gl/dist/mapbox-gl.css');
        }

        if (!existingProvider) {
          // Provider not registered, register and initialize it
          if (providerName === 'maptiler') {
            registerUIProvider('maptiler', new MapTilerUIProvider());
            // Only pass config if explicitly provided via attributes
            provider = await getProviderByName('maptiler', apiKey ? { apiKey } : undefined);
          } else if (providerName === 'mapbox') {
            const { MapboxUIProvider } = await import('../../providers/mapbox-provider');
            registerUIProvider('mapbox', new MapboxUIProvider());
            // Only pass config if explicitly provided via attributes
            // Access env var - Vite will replace import.meta.env at build time
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - import.meta is available in ESNext modules
            const token = accessToken || import.meta.env?.MAPBOX_ACCESS_TOKEN;
            provider = await getProviderByName(
              'mapbox',
              token ? { accessToken: token } : undefined
            );
          } else {
            throw new Error(`Unknown provider: ${providerName}. Supported: maptiler, mapbox`);
          }
        } else {
          // Initialize existing provider with config (if provided)
          let config: { accessToken?: string } | { apiKey?: string } | undefined = undefined;
          if (providerName === 'mapbox') {
            // Access env var - Vite will replace import.meta.env at build time
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - import.meta is available in ESNext modules
            const token = accessToken || import.meta.env?.MAPBOX_ACCESS_TOKEN;
            if (token) config = { accessToken: token };
          } else if (apiKey) {
            config = { apiKey };
          }
          provider = await getProviderByName(providerName, config);
        }
      } else {
        // Auto-initialize MapTiler provider if api-key is present
        try {
          provider = this.getUIProvider(); // Check if default provider exists
        } catch {
          // No provider set, auto-initialize MapTiler if we have an API key
          if (apiKey) {
            console.warn('[geokit] Auto-initializing MapTiler provider from api-key attribute');
            registerUIProvider('maptiler', new MapTilerUIProvider());
            const { getProviderByName } = await import('../../providers/registry');
            provider = await getProviderByName('maptiler', { apiKey });
          } else {
            throw new Error(
              'No UI provider set. Add provider="maptiler" or provider="mapbox" attribute, or provide api-key for auto MapTiler initialization'
            );
          }
        }
      }

      const container = this as HTMLElement;

      if (!container) {
        throw new Error('Map container not found');
      }

      // Get map style from 'map-style' attribute only
      // DO NOT use 'style' attribute - that's for CSS, not map tiles!
      // Default to streets to avoid deprecated styles and API key requirements
      const styleAttr = this.getAttribute('map-style') || 'streets';

      const options = {
        lat: parseFloat(this.getAttribute('lat') || '0'),
        lng: parseFloat(this.getAttribute('lng') || '0'),
        zoom: parseFloat(this.getAttribute('zoom') || '2'),
        pitch: parseFloat(this.getAttribute('pitch') || '0'),
        bearing: parseFloat(this.getAttribute('bearing') || '0'),
        style: styleAttr,
        interactive: this.getAttribute('interactive') !== 'false',
      };

      this.map = await provider.createMap(container, options);

      // Store reference to canvas for freeze/unfreeze
      if (this.map) {
        const mapContainer = (this.map as any).getContainer?.();
        if (mapContainer) {
          this._mapCanvas = mapContainer.querySelector('canvas');
        }
      }

      // Ensure map has a valid, non-deprecated style after creation
      // This handles cases where the SDK might default to deprecated styles
      // Wait for style to load before trying to set it
      this.ensureValidMapStyleAfterLoad();

      // Check if map is already loaded (style might load synchronously or very fast)
      // Use try-catch because isStyleLoaded may access properties that don't exist yet
      let styleAlreadyLoaded = false;
      try {
        const isStyleLoaded = (this.map as { isStyleLoaded?: () => boolean }).isStyleLoaded;
        if (isStyleLoaded && this.map) {
          styleAlreadyLoaded = isStyleLoaded.call(this.map);
        }
      } catch {
        // Map not ready yet, will wait for load event
        styleAlreadyLoaded = false;
      }

      // Set up features based on attributes
      this.setupHideAttribution();

      if (styleAlreadyLoaded) {
        // Style already loaded, wait for idle event to ensure control system is ready
        this.isInitialized = true;
        this.hidePlaceholder();
        if (this.map) {
          this.map.once('idle', () => {
            this.setupAutoHideControls();
            this.dispatchEvent(
              new CustomEvent('gk-map-ready', {
                detail: { map: this.map, element: this },
                bubbles: true,
              })
            );
          });
        }
      } else {
        // Wait for map to be fully loaded, then wait for idle
        if (this.map) {
          this.map.on('load', () => {
            this.isInitialized = true;
            this.hidePlaceholder();
            // Wait for idle to ensure internal control system is initialized
            if (this.map) {
              this.map.once('idle', () => {
                this.setupAutoHideControls();
                this.dispatchEvent(
                  new CustomEvent('gk-map-ready', {
                    detail: { map: this.map, element: this },
                    bubbles: true,
                  })
                );
              });
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to initialize map:', error);
      // Keep placeholder visible on error
    } finally {
      this._isInitializing = false;
    }
  }

  /**
   * Ensure map has a valid, non-deprecated style after it loads
   */
  private ensureValidMapStyleAfterLoad(): void {
    if (!this.map) return;

    const map = this.map as any;
    if (!map.setStyle || typeof map.setStyle !== 'function') {
      return;
    }

    // Always wait for load event to ensure style is ready
    // Use once() to avoid multiple listeners, but check if already loaded first
    const checkAndSet = () => {
      // Use setTimeout to ensure style is fully ready
      setTimeout(() => {
        this.checkAndUpdateStyle();
      }, 0);
    };

    // Check if already loaded
    const isStyleLoaded = map.isStyleLoaded?.();
    if (isStyleLoaded && typeof isStyleLoaded === 'function' && isStyleLoaded.call(map)) {
      // Already loaded, but wait a tick to ensure it's fully ready
      checkAndSet();
    } else {
      // Wait for load event
      map.once('load', checkAndSet);
    }
  }

  /**
   * Check current style and update if needed
   */
  private checkAndUpdateStyle(): void {
    if (!this.map) return;

    try {
      const map = this.map as any;
      if (!map.setStyle || typeof map.setStyle !== 'function') {
        return;
      }

      // Get API key for building style URL
      const apiKey = this.getAttribute('api-key') || '';
      if (!apiKey) return; // Can't set style without API key

      const validStyle = `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${apiKey}`;

      // Check current style - could be an object with name property or a URL string
      const currentStyle = map.getStyle?.();
      let needsReplacement = false;

      if (currentStyle) {
        if (typeof currentStyle === 'object' && currentStyle.name === 'Streets Default v2') {
          needsReplacement = true;
        } else if (typeof currentStyle === 'string' && currentStyle.includes('streets-v2')) {
          needsReplacement = true;
        } else if (typeof currentStyle === 'string' && !currentStyle.includes('api.maptiler.com')) {
          // If it's not a valid MapTiler URL, replace it
          needsReplacement = true;
        }
      } else {
        // No style set - set a valid one
        needsReplacement = true;
      }

      if (needsReplacement) {
        // Check if style is loaded before setting
        const isStyleLoaded = map.isStyleLoaded?.();
        if (isStyleLoaded && typeof isStyleLoaded === 'function') {
          if (!isStyleLoaded.call(map)) {
            // Style not loaded yet, wait for it
            map.once('load', () => {
              try {
                // Double-check style is loaded before setting
                if (map.isStyleLoaded?.()?.call(map)) {
                  map.setStyle(validStyle);
                }
              } catch {
                // Ignore style setting errors - map will rebuild from scratch
              }
            });
            return;
          }
        }
        // Style is loaded, safe to set (but wrap in try-catch for safety)
        try {
          map.setStyle(validStyle);
        } catch {
          // If style isn't ready, it will rebuild from scratch - this is fine
        }
      }
    } catch {
      // Style check/set failed - continue anyway
      // This is non-critical, map will still work
    }
  }

  /**
   * Show placeholder if map is not initialized
   * The placeholder is a child of the gk-map element itself
   */
  private showPlaceholderIfNeeded(): void {
    // Don't show placeholder if map is already initialized
    if (this.isInitialized || this.map) {
      return;
    }
    this.showPlaceholder();
  }

  /**
   * Show placeholder (public method for map collection)
   */
  public showPlaceholder(message: string = 'Loading map...'): void {
    // Check if placeholder already exists
    const existingPlaceholder = this.querySelector(
      '.map-placeholder, [data-map-placeholder="true"]'
    ) as HTMLElement | null;

    if (existingPlaceholder) {
      // Update message if different
      if (existingPlaceholder.textContent !== message) {
        existingPlaceholder.textContent = message;
      }
      return;
    }

    // Create placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'map-placeholder';
    placeholder.setAttribute('data-map-placeholder', 'true');
    placeholder.style.cssText =
      'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: var(--gk-placeholder-color, #141414); display: flex; align-items: center; justify-content: center; color: #8b949e; font-size: 0.9rem; z-index: 1;';
    placeholder.textContent = message;
    this.appendChild(placeholder);
  }

  /**
   * Hide placeholder when map is ready (public method for map collection)
   */
  public hidePlaceholder(): void {
    const placeholders = this.querySelectorAll('.map-placeholder, [data-map-placeholder="true"]');
    placeholders.forEach((placeholder) => placeholder.remove());
  }

  /**
   * Check if map has a placeholder
   */
  public hasPlaceholder(): boolean {
    return !!this.querySelector('.map-placeholder, [data-map-placeholder="true"]');
  }

  /**
   * Set up hide attribution behavior
   * Attribution is hidden by default unless `show-attribution` is present
   */
  private setupHideAttribution(): void {
    // Attribution hidden by default - use show-attribution to display it
    if (this.hasAttribute('show-attribution')) return;

    this.injectHideAttributionStyles();
    this.classList.add('gk-hide-attribution');
  }

  /**
   * Inject CSS styles to hide attribution (once per document)
   */
  private injectHideAttributionStyles(): void {
    const styleId = 'gk-hide-attribution-style';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .gk-hide-attribution .maplibregl-ctrl-attrib,
      .gk-hide-attribution .mapboxgl-ctrl-attrib,
      .gk-hide-attribution .maplibregl-ctrl-logo,
      .gk-hide-attribution .mapboxgl-ctrl-logo,
      .gk-hide-attribution .maptiler-ctrl-logo,
      .gk-hide-attribution .maplibregl-compact-show,
      .gk-hide-attribution .mapboxgl-compact-show,
      .gk-hide-attribution a[href*="maptiler"],
      .gk-hide-attribution a[href*="mapbox"],
      .gk-hide-attribution a[href*="maplibre"],
      .gk-hide-attribution a[href*="openstreetmap"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Set up auto-hide controls behavior
   * When enabled, controls are hidden until the user hovers/focuses the map
   */
  private setupAutoHideControls(): void {
    if (!this.hasAttribute('auto-hide-controls')) return;

    // Inject CSS for auto-hide behavior (only once)
    this.injectAutoHideStyles();

    // Initially hide controls via class
    this.classList.add('gk-controls-hidden');
    this._controlsVisible = false;

    // Show controls on mouse enter
    this._mouseEnterHandler = () => this.setControlsVisible(true);
    this._mouseLeaveHandler = () => this.setControlsVisible(false);

    this.addEventListener('mouseenter', this._mouseEnterHandler);
    this.addEventListener('mouseleave', this._mouseLeaveHandler);
  }

  /**
   * Inject CSS styles for auto-hide controls (once per document)
   */
  private injectAutoHideStyles(): void {
    const styleId = 'gk-auto-hide-controls-style';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      gk-map.gk-controls-hidden .maplibregl-ctrl-group,
      gk-map.gk-controls-hidden .mapboxgl-ctrl-group,
      gk-map.gk-controls-hidden .maplibregl-ctrl,
      gk-map.gk-controls-hidden .mapboxgl-ctrl,
      gk-map.gk-controls-hidden [class*="maplibregl-ctrl"],
      gk-map.gk-controls-hidden [class*="mapboxgl-ctrl"],
      .gk-controls-hidden .maplibregl-ctrl-group,
      .gk-controls-hidden .mapboxgl-ctrl-group,
      .gk-controls-hidden .maplibregl-ctrl,
      .gk-controls-hidden .mapboxgl-ctrl {
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.2s ease-in-out !important;
      }
      gk-map:not(.gk-controls-hidden) .maplibregl-ctrl-group,
      gk-map:not(.gk-controls-hidden) .mapboxgl-ctrl-group,
      gk-map:not(.gk-controls-hidden) .maplibregl-ctrl,
      gk-map:not(.gk-controls-hidden) .mapboxgl-ctrl,
      gk-map:not(.gk-controls-hidden) [class*="maplibregl-ctrl"],
      gk-map:not(.gk-controls-hidden) [class*="mapboxgl-ctrl"] {
        opacity: 1 !important;
        pointer-events: auto !important;
        transition: opacity 0.2s ease-in-out;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Clean up auto-hide event listeners
   */
  private cleanupAutoHideControls(): void {
    if (this._mouseEnterHandler) {
      this.removeEventListener('mouseenter', this._mouseEnterHandler);
      this._mouseEnterHandler = null;
    }
    if (this._mouseLeaveHandler) {
      this.removeEventListener('mouseleave', this._mouseLeaveHandler);
      this._mouseLeaveHandler = null;
    }
  }

  /**
   * Show or hide map controls
   * Works with SDK controls added via addControl()
   * @param visible - Whether controls should be visible
   */
  public setControlsVisible(visible: boolean): void {
    this._controlsVisible = visible;

    if (visible) {
      this.classList.remove('gk-controls-hidden');
    } else {
      this.classList.add('gk-controls-hidden');
    }

    this.dispatchEvent(
      new CustomEvent('controls-visibility-change', {
        detail: { visible },
        bubbles: true,
      })
    );
  }

  /**
   * Check if controls are currently visible
   */
  public areControlsVisible(): boolean {
    return this._controlsVisible;
  }

  /**
   * Toggle controls visibility
   */
  public toggleControls(): void {
    this.setControlsVisible(!this._controlsVisible);
  }

  protected handleAttributeChange(
    name: string,
    _oldValue: string | null,
    newValue: string | null
  ): void {
    // Handle auto-hide-controls toggle (doesn't require map)
    if (name === 'auto-hide-controls') {
      if (newValue !== null) {
        this.setupAutoHideControls();
      } else {
        this.cleanupAutoHideControls();
        this.setControlsVisible(true);
      }
      return;
    }

    if (!this.map) return;

    switch (name) {
      case 'lat':
      case 'lng':
        this.updateCenter();
        break;
      case 'zoom':
        if (newValue) {
          const setZoom = (this.map as { setZoom?: (zoom: number) => void }).setZoom;
          if (setZoom) {
            setZoom(parseFloat(newValue));
          }
        }
        break;
      case 'pitch':
        if (newValue) {
          const setPitch = (this.map as { setPitch?: (pitch: number) => void }).setPitch;
          if (setPitch) {
            setPitch(parseFloat(newValue));
          }
        }
        break;
      case 'bearing':
        if (newValue) {
          const setBearing = (this.map as { setBearing?: (bearing: number) => void }).setBearing;
          if (setBearing) {
            setBearing(parseFloat(newValue));
          }
        }
        break;
    }
  }

  private updateCenter(): void {
    if (!this.map) return;

    const lat = parseFloat(this.getAttribute('lat') || '0');
    const lng = parseFloat(this.getAttribute('lng') || '0');

    const setCenter = (this.map as { setCenter?: (center: [number, number]) => void }).setCenter;
    if (setCenter) {
      setCenter([lng, lat]);
    }
  }

  // Public API
  public getMap(): MapInstance | null {
    return this.map;
  }

  public setCenter(lat: number, lng: number): void {
    this.setAttribute('lat', lat.toString());
    this.setAttribute('lng', lng.toString());
  }

  public setZoom(zoom: number): void {
    this.setAttribute('zoom', zoom.toString());
  }

  public flyTo(lat: number, lng: number, zoom?: number): void {
    if (!this.map) return;

    const flyTo = (
      this.map as { flyTo?: (options: { center: [number, number]; zoom: number }) => void }
    ).flyTo;
    const getZoom = (this.map as { getZoom?: () => number }).getZoom;
    if (flyTo) {
      const targetZoom = zoom !== undefined ? zoom : (getZoom?.() ?? 10);
      flyTo({
        center: [lng, lat],
        zoom: targetZoom,
      });
    }
  }

  /**
   * Clear all child elements (points, polygons, etc.)
   * Used by map pool to reset maps when reassigning
   * Ensures proper cleanup by triggering disconnectedCallback on each child
   * Also cleans up any dangling layers/sources in the map
   */
  public clearChildren(): void {
    const map = this.getMap();

    // Remove all children except the ones in shadow DOM
    const children = Array.from(this.children);
    children.forEach((child) => {
      // Trigger cleanup before removing (disconnectedCallback handles layer/source cleanup)
      if (
        typeof (child as HTMLElement & { disconnectedCallback?: () => void })
          .disconnectedCallback === 'function'
      ) {
        try {
          (child as HTMLElement & { disconnectedCallback: () => void }).disconnectedCallback();
        } catch (error) {
          console.warn(`Error in disconnectedCallback for ${child.tagName}:`, error);
        }
      }
      // Remove the element from DOM
      child.remove();
    });

    // Clean up any dangling layers/sources that might not have been cleaned up
    if (map && map.getLayer && map.removeLayer && map.getSource && map.removeSource) {
      try {
        // Get all layers and remove custom ones
        const style = (
          map as { getStyle?: () => { layers?: Array<{ id?: string }> } }
        ).getStyle?.();
        if (style?.layers) {
          style.layers.forEach((layer) => {
            const layerId = layer.id;
            if (
              layerId &&
              (layerId.startsWith('point-') ||
                layerId.startsWith('polygon-') ||
                layerId.startsWith('polyline-') ||
                layerId.startsWith('marker-'))
            ) {
              try {
                if (map.getLayer?.(layerId)) {
                  map.removeLayer?.(layerId);
                }
              } catch {
                // Layer might already be removed
              }
            }
          });
        }

        // Remove custom sources
        if (style && 'sources' in style && style.sources) {
          Object.keys(style.sources as Record<string, unknown>).forEach((sourceId) => {
            if (
              sourceId.startsWith('point-') ||
              sourceId.startsWith('polygon-') ||
              sourceId.startsWith('polyline-') ||
              sourceId.startsWith('marker-')
            ) {
              try {
                if (map.getSource?.(sourceId)) {
                  map.removeSource?.(sourceId);
                }
              } catch {
                // Source might already be removed
              }
            }
          });
        }
      } catch (error) {
        console.warn('Error cleaning up dangling layers/sources:', error);
      }
    }
  }

  /**
   * Get count of child elements by type
   * Used for debugging and verification
   */
  public getChildCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    const children = Array.from(this.children);

    children.forEach((child) => {
      const tagName = child.tagName.toLowerCase();
      counts[tagName] = (counts[tagName] || 0) + 1;
    });

    return counts;
  }

  /**
   * Check if map is currently populating data
   */
  public isPopulating(): boolean {
    return this.hasAttribute('data-populating');
  }

  /**
   * Set whether map is currently populating
   */
  public setPopulating(populating: boolean): void {
    if (populating) {
      this.setAttribute('data-populating', 'true');
    } else {
      this.removeAttribute('data-populating');
    }
  }

  /**
   * Pool management methods (for map-collection)
   */

  /**
   * Check if map is pool-managed
   */
  public isPoolManaged(): boolean {
    return this.hasAttribute('data-pool-managed');
  }

  /**
   * Set pool-managed state
   */
  public setPoolManaged(managed: boolean): void {
    if (managed) {
      this.setAttribute('data-pool-managed', 'true');
    } else {
      this.removeAttribute('data-pool-managed');
    }
  }

  /**
   * Check if map is in pool
   */
  public isInPool(): boolean {
    return this.hasAttribute('data-pool-map');
  }

  /**
   * Set pool state (in pool, pool index)
   */
  public setPoolState(inPool: boolean, poolIndex?: number): void {
    if (inPool) {
      this.setAttribute('data-pool-map', 'true');
      if (poolIndex !== undefined) {
        this.setAttribute('data-pool-index', poolIndex.toString());
      }
      this.removeAttribute('data-pool-managed');
    } else {
      this.removeAttribute('data-pool-map');
      this.removeAttribute('data-pool-index');
      this.setAttribute('data-pool-managed', 'true');
    }
  }

  /**
   * Get pool index
   */
  public getPoolIndex(): number | null {
    const index = this.getAttribute('data-pool-index');
    return index ? parseInt(index, 10) : null;
  }

  /**
   * Ensure map has required attributes from parent collection
   */
  public ensureAttributes(options: {
    apiKey?: string | null;
    provider?: string;
    mapStyle?: string | null;
  }): void {
    if (options.apiKey && !this.getAttribute('api-key')) {
      this.setAttribute('api-key', options.apiKey);
    }
    if (options.provider && !this.getAttribute('provider')) {
      this.setAttribute('provider', options.provider);
    }
    if (options.mapStyle && !this.getAttribute('map-style') && !this.getAttribute('style')) {
      this.setAttribute('map-style', options.mapStyle);
    }
  }

  /**
   * Check if map instance is rendering (has visible canvas)
   */
  public isRendering(): boolean {
    if (!this.map) return false;

    try {
      const getContainer = (this.map as any).getContainer;
      if (getContainer && typeof getContainer === 'function') {
        const container = getContainer.call(this.map);
        if (container) {
          const canvas = container.querySelector('canvas');
          return !!canvas && canvas.offsetWidth > 0 && canvas.offsetHeight > 0;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if map is still loading (style not yet loaded)
   */
  public isLoading(): boolean {
    if (!this.map) return false;

    try {
      // Check if style is loaded - if not, map is still loading
      if (
        typeof (this.map as any).isStyleLoaded === 'function' &&
        !(this.map as any).isStyleLoaded()
      ) {
        return true;
      }
      // Also check general loaded state
      if (typeof (this.map as any).loaded === 'function' && !(this.map as any).loaded()) {
        return true;
      }
      return false;
    } catch {
      // If we can't check, assume it's not loading
      return false;
    }
  }

  /**
   * Unfreeze the map - initialize and show when ready
   * If map is frozen, unfreezes it. Otherwise creates new map.
   * Placeholder is hidden automatically when map loads
   *
   * @param poolIndex - Optional pool index for tracking
   * @returns Promise that resolves when map is ready
   */
  public async unfreeze(poolIndex?: number): Promise<boolean> {
    // Prevent concurrent unfreeze operations
    if (this._isUnfreezing) {
      console.warn('[gk-map] Already unfreezing, skipping duplicate call');
      return false;
    }

    this._isUnfreezing = true;

    // Show placeholder while loading
    this.showPlaceholder('Loading map...');

    // Set pool state
    this.setPoolState(true, poolIndex);

    try {
      // If map is frozen, unfreeze it (reinitialize since we destroyed it)
      if (this._isFrozen) {
        this.showPlaceholder('Restoring map...');
        await this._unfreeze();
        // Wait for map to be fully ready after reinitialization
        if (this.map) {
          await this.waitForReady();
        }
        this.hidePlaceholder();
        return true;
      }

      // If map already exists and is initialized, just hide placeholder
      if (this.map && this.isInitialized) {
        this.hidePlaceholder();
        return true;
      }

      // Initialize the map
      await this.initializeMap();

      // Wait for map to be fully ready
      if (this.map) {
        await this.waitForReady();
        this.hidePlaceholder();
        return true;
      }

      // Map failed to initialize - show error
      this.showPlaceholder('Map failed to load');
      return false;
    } catch (error) {
      console.warn('[gk-map] Failed to unfreeze:', error);
      // Reset frozen state on failure so it can be retried
      this._isFrozen = false;
      this.showPlaceholder('Map load error');
      return false;
    } finally {
      this._isUnfreezing = false;
    }
  }

  /**
   * Freeze the map - hide canvas and pause rendering
   * Destroys the WebGL context to free resources
   * Returns a Promise that resolves when the context is released
   */
  public async freeze(): Promise<void> {
    // Wait if currently unfreezing to avoid race condition
    if (this._isUnfreezing) {
      console.warn('[gk-map] Waiting for unfreeze to complete before freezing');
      // Wait up to 10 seconds for unfreeze to complete
      const maxWait = 10000;
      const startTime = Date.now();
      while (this._isUnfreezing && Date.now() - startTime < maxWait) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Show placeholder with "Restoring map..." message
    this.showPlaceholder('Restoring map...');

    // Destroy the map to free WebGL context
    // Browsers can only handle a few WebGL contexts, so we must destroy when frozen
    if (this.map) {
      await this._freeze();
    }

    // Update pool state - no longer in pool
    this.setPoolState(false);
  }

  /**
   * Internal freeze implementation - destroy map and free WebGL context
   * Browsers can only handle a few WebGL contexts, so we must destroy when frozen
   * Returns a Promise that resolves after the context is released
   */
  private async _freeze(): Promise<void> {
    if (!this.map || this._isFrozen) {
      return;
    }

    // Wait if currently initializing to avoid race condition
    if (this._isInitializing) {
      console.warn('[gk-map] Waiting for initialization to complete before freezing');
      const maxWait = 5000;
      const startTime = Date.now();
      while (this._isInitializing && Date.now() - startTime < maxWait) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      // Re-check if map still exists after waiting
      if (!this.map || this._isFrozen) {
        return;
      }
    }

    // Dispatch unload event before destroying
    this.dispatchEvent(
      new CustomEvent('gk-map-unload', {
        detail: { map: this.map, element: this },
        bubbles: true,
      })
    );

    // Remove the map instance to free WebGL context
    // Suppress MapTiler SDK warnings during removal (deprecated style warnings, setStyle errors)
    const map = this.map as any;
    if (typeof map.remove === 'function') {
      // Temporarily suppress console.warn during map removal
      // The SDK logs "deprecated style" and "invalid style" warnings that are harmless
      const originalWarn = console.warn;
      const originalLog = console.log;

      // Suppress specific MapTiler SDK warnings
      const suppressedPatterns = ['deprecated', 'Invalid style', 'setStyle', 'webglcontextlost'];

      const shouldSuppress = (args: unknown[]): boolean => {
        const message = args
          .map((a) => String(a))
          .join(' ')
          .toLowerCase();
        return suppressedPatterns.some((pattern) =>
          message.toLowerCase().includes(pattern.toLowerCase())
        );
      };

      console.warn = (...args: unknown[]) => {
        if (!shouldSuppress(args)) {
          originalWarn.apply(console, args);
        }
      };

      console.log = (...args: unknown[]) => {
        if (!shouldSuppress(args)) {
          originalLog.apply(console, args);
        }
      };

      try {
        map.remove();
      } catch (error) {
        // Ignore errors during removal - the map may have been partially initialized
        // Common error: "Cannot read properties of undefined (reading 'off')" or "can't access property 'off', this._map is undefined"
        // This happens when event handlers weren't fully registered before removal or map was already destroyed
        // Suppress in production to avoid console spam - this is a harmless error from MapTiler SDK
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isHarmlessError = 
          errorMessage.includes("can't access property") ||
          errorMessage.includes("Cannot read properties") ||
          errorMessage.includes("this._map is undefined") ||
          errorMessage.includes("reading 'off'");
        
        // Only log non-harmless errors or in development
        if (!isHarmlessError || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')) {
          console.debug('[gk-map] Ignoring error during map removal:', error);
        }
      } finally {
        // Restore console methods
        console.warn = originalWarn;
        console.log = originalLog;
      }
    }

    // Clear map reference
    this.map = null;
    this._mapCanvas = null;
    this.isInitialized = false;
    this._isFrozen = true;

    // Wait a frame to ensure WebGL context is fully released
    // This prevents "Too many active WebGL contexts" warnings
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  /**
   * Internal unfreeze implementation - reinitialize the map
   * Since we destroy the map when frozen, we need to recreate it
   */
  private async _unfreeze(): Promise<void> {
    if (!this._isFrozen) {
      return;
    }

    // Map was destroyed, so we need to reinitialize it
    this._isFrozen = false;

    // Set flag to indicate map was just unfrozen - this helps isochrones restore
    this.dataset.wasJustUnfrozen = 'true';

    await this.initializeMap();

    // Clear flag after a short delay to allow isochrones to restore
    setTimeout(() => {
      delete this.dataset.wasJustUnfrozen;
    }, 2000);
  }

  /**
   * Wait for map to be fully ready (idle state)
   */
  private waitForReady(timeout: number = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.map) {
        reject(new Error('No map instance'));
        return;
      }

      const map = this.map as any;

      // Check if already ready
      if (typeof map.loaded === 'function' && map.loaded()) {
        resolve();
        return;
      }

      // Set timeout
      const timeoutId = setTimeout(() => {
        reject(new Error('Map ready timeout'));
      }, timeout);

      // Wait for idle event
      const handleIdle = () => {
        clearTimeout(timeoutId);
        resolve();
      };

      if (typeof map.once === 'function') {
        map.once('idle', handleIdle);
      } else {
        // Fallback: resolve after short delay
        setTimeout(() => {
          clearTimeout(timeoutId);
          resolve();
        }, 500);
      }
    });
  }

  /**
   * Wait for map style to be loaded
   * Returns immediately if already loaded
   */
  public async whenStyleReady(timeout: number = 10000): Promise<void> {
    if (!this.map) {
      throw new Error('[gk-map] No map instance');
    }

    const map = this.map as any;

    // Check if already loaded
    if (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) {
      return;
    }

    return new Promise((resolve, _reject) => {
      const timeoutId = setTimeout(() => {
        map.off?.('style.load', handleStyleLoad);
        map.off?.('load', handleLoad);
        // Resolve anyway after timeout - map might be usable
        console.warn('[gk-map] Style load timeout, proceeding anyway');
        resolve();
      }, timeout);

      const handleStyleLoad = () => {
        clearTimeout(timeoutId);
        map.off?.('load', handleLoad);
        resolve();
      };

      const handleLoad = () => {
        if (map.isStyleLoaded?.()) {
          clearTimeout(timeoutId);
          map.off?.('style.load', handleStyleLoad);
          resolve();
        }
      };

      map.on?.('style.load', handleStyleLoad);
      map.on?.('load', handleLoad);

      // Also poll in case events don't fire
      const checkReady = () => {
        if (map.isStyleLoaded?.()) {
          clearTimeout(timeoutId);
          map.off?.('style.load', handleStyleLoad);
          map.off?.('load', handleLoad);
          resolve();
        } else {
          requestAnimationFrame(checkReady);
        }
      };
      requestAnimationFrame(checkReady);
    });
  }

  /**
   * Set map bounds with proper timing handling
   * Handles resize, fitBounds, and ensures visual update
   *
   * @param bbox - Bounding box [minLng, minLat, maxLng, maxLat]
   * @param options - Optional fitBounds options
   */
  public async setBounds(
    bbox: [number, number, number, number],
    options: {
      padding?: number | { top: number; bottom: number; left: number; right: number };
      pitch?: number;
      bearing?: number;
      maxZoom?: number;
    } = {}
  ): Promise<void> {
    if (!this.map) {
      throw new Error('[gk-map] No map instance');
    }

    const map = this.map as any;
    const [minLng, minLat, maxLng, maxLat] = bbox;

    // Default padding
    const padding = options.padding ?? { top: 40, bottom: 40, left: 40, right: 40 };
    const pitch = options.pitch ?? 0;
    const bearing = options.bearing ?? 0;

    // Wait for style to be ready
    await this.whenStyleReady();

    // Ensure map has proper dimensions
    const rect = this.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      // Wait for layout
      await new Promise<void>((resolve) => {
        const check = () => {
          const r = this.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        };
        check();
      });
    }

    // Resize map to ensure canvas dimensions are correct
    if (typeof map.resize === 'function') {
      map.resize();
    }

    // Wait a frame for resize to take effect
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Apply fitBounds
    try {
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        {
          padding,
          pitch,
          bearing,
          duration: 0, // Instant, no animation
          maxZoom: options.maxZoom,
        }
      );

      // Force repaint
      if (typeof map.triggerRepaint === 'function') {
        map.triggerRepaint();
      }

      // Wait for viewport to settle
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });
    } catch (error) {
      console.warn('[gk-map] Error in setBounds:', error);
      // Fallback to center
      const centerLng = (minLng + maxLng) / 2;
      const centerLat = (minLat + maxLat) / 2;
      try {
        map.jumpTo?.({ center: [centerLng, centerLat], pitch, bearing });
      } catch {
        // Ignore fallback errors
      }
    }
  }

  /**
   * Add GeoJSON points to the map
   * Delegates to PointElement.createFromGeoJSON() and appends results
   *
   * @param geojson - GeoJSON FeatureCollection with Point features
   * @param options - Optional styling and behavior options
   * @returns Number of points added
   */
  public addPointsFromGeoJSON(
    geojson: GeoJSON.FeatureCollection,
    options: {
      color?: string;
      size?: number;
      opacity?: number;
      blur?: number;
      shadow?: boolean;
      shadowColor?: string;
      shadowBlur?: number;
      shadowOpacity?: number;
      strokeWidth?: number;
      strokeColor?: string;
      idProperty?: string;
      nameProperty?: string;
    } = {}
  ): number {
    const points = PointElement.createFromGeoJSON(geojson, options);
    points.forEach((point) => this.appendChild(point));
    return points.length;
  }

  /**
   * Add GeoJSON polygon to the map
   * Delegates to PolygonElement.createFromGeoJSON() and appends results
   *
   * @param geojson - GeoJSON Feature or Geometry
   * @param options - Optional styling options
   * @returns Number of polygons added
   */
  public addPolygonFromGeoJSON(
    geojson: GeoJSON.Feature | GeoJSON.Geometry,
    options: {
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeWidth?: number;
      strokeOpacity?: number;
      visible?: boolean;
      simplify?: boolean;
      maxPoints?: number;
    } = {}
  ): number {
    const polygons = PolygonElement.createFromGeoJSON(geojson, options);
    polygons.forEach((polygon) => this.appendChild(polygon));
    return polygons.length;
  }
}

// Register custom element
if (!customElements.get('gk-map')) {
  customElements.define('gk-map', MapElement);
}
