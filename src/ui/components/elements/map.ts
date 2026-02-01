/**
 * Map Component
 *
 * Main map container component
 *
 * Usage:
 * <mapi-map lat="40.7128" lng="-74.006" zoom="10" style="streets"></mapi-map>
 */

import { BaseElement } from '../base-element';
import { registerUIProvider, getProviderByName } from '../../providers/registry';
import { MapTilerUIProvider } from '../../providers/maptiler-provider';
import { PointElement } from './point';
import { PolygonElement } from './polygon';
import { type IsochroneElement } from './isochrone';
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
    'max-pitch',
    'bearing',
    'interactive',
    'hide-controls',
    'auto-hide-controls',
    'show-attribution',
    'provider',
    'sync-url',
  ];

  private _controlsVisible: boolean = true;
  private _mouseEnterHandler: (() => void) | null = null;
  private _mouseLeaveHandler: (() => void) | null = null;
  private _isFrozen: boolean = false;
  private _isUnfreezing: boolean = false; // Prevent race conditions
  private _isInitializing: boolean = false; // Prevent concurrent initialization
  private _frozenContainerStyle: { display?: string; visibility?: string } | null = null;
  private _mapCanvas: HTMLCanvasElement | null = null;

  // URL sync state
  private _urlSyncEnabled: boolean = false;
  private _urlSyncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _hashChangeHandler: (() => void) | null = null;
  private _mapMoveEndHandler: (() => void) | null = null;
  private _isUpdatingFromUrl: boolean = false; // Prevent circular updates

  // Child element tracking
  private _childObserver: MutationObserver | null = null;
  private _trackedChildren: Map<string, Set<HTMLElement>> = new Map();

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

    // Initialize child element tracking
    this._initializeChildTracking();

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

    // Clean up URL sync listeners
    this.cleanupUrlSync();

    // Clean up child tracking observer
    this._cleanupChildTracking();

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
        const existingProvider = await getProviderByName(providerName).catch(() => null);

        // Load CSS for the provider (skip if already loaded via preload)
        if (providerName === 'maptiler') {
          // Check if CSS is already loaded (e.g., via HTML preload)
          const hasMaptilerCss = Array.from(document.styleSheets).some((sheet) =>
            sheet.href?.includes('maptiler-sdk')
          );
          if (!hasMaptilerCss) {
            await import('@maptiler/sdk/dist/maptiler-sdk.css');
          }
        } else if (providerName === 'mapbox') {
          const hasMapboxCss = Array.from(document.styleSheets).some((sheet) =>
            sheet.href?.includes('mapbox-gl')
          );
          if (!hasMapboxCss) {
            await import('mapbox-gl/dist/mapbox-gl.css');
          }
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
            const token = accessToken || import.meta.env?.MAPBOX_TOKEN;
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
            const token = accessToken || import.meta.env?.MAPBOX_TOKEN;
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

      // Parse max-pitch attribute (default 60 prevents disorienting "upside down" tilting)
      const maxPitchAttr = this.getAttribute('max-pitch');
      const maxPitch = maxPitchAttr ? parseFloat(maxPitchAttr) : undefined;

      // Check for URL hash state if sync-url is enabled
      const urlState = this.hasAttribute('sync-url') ? this.parseUrlHashState() : null;

      const options = {
        lat: urlState?.lat ?? parseFloat(this.getAttribute('lat') || '0'),
        lng: urlState?.lng ?? parseFloat(this.getAttribute('lng') || '0'),
        zoom: urlState?.zoom ?? parseFloat(this.getAttribute('zoom') || '2'),
        pitch: urlState?.pitch ?? parseFloat(this.getAttribute('pitch') || '0'),
        maxPitch,
        bearing: urlState?.bearing ?? parseFloat(this.getAttribute('bearing') || '0'),
        style: styleAttr,
        interactive: this.getAttribute('interactive') !== 'false',
      };

      this.map = await provider.createMap(container, options);

      // Wrap queryRenderedFeatures so MapLibre/MapTiler "unknown feature value" never throws
      if (this.map?.queryRenderedFeatures) {
        const original = this.map.queryRenderedFeatures.bind(this.map);
        this.map.queryRenderedFeatures = (
          point: { x: number; y: number },
          options?: { layers?: string[] }
        ) => {
          try {
            return original(point, options);
          } catch {
            return [];
          }
        };
      }

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
      this.injectControlThemeStyles();

      // Optimize: Dispatch map-ready immediately when style is loaded
      // Don't wait for 'idle' - it can delay by hundreds of ms
      // Non-critical setup (controls, URL sync) is deferred to avoid blocking
      const dispatchMapReady = () => {
        this.isInitialized = true;
        this.hidePlaceholder();

        // Dispatch map-ready immediately so layers can be added
        this.dispatchEvent(
          new CustomEvent('gk-map-ready', {
            detail: { map: this.map, element: this },
            bubbles: true,
          })
        );

        // Defer non-critical setup to avoid blocking first paint
        const deferredSetup = () => {
          this.setupAutoHideControls();
          this.setupUrlSync();
        };

        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(deferredSetup, { timeout: 200 });
        } else {
          // Fallback for Safari (no requestIdleCallback)
          setTimeout(deferredSetup, 0);
        }
      };

      if (styleAlreadyLoaded) {
        // Style already loaded - dispatch immediately (no idle wait)
        dispatchMapReady();
      } else {
        // Wait for style to load, then dispatch immediately (no idle wait)
        if (this.map) {
          this.map.once('load', () => {
            dispatchMapReady();
          });
        }
      }
    } catch (error) {
      console.error('Failed to initialize map:', error);
      // Keep placeholder visible on error, but ensure it shows an error message
      this.showPlaceholder('Map failed to initialize');
      // Reset initialization flag so it can be retried
      this.isInitialized = false;
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
        if (typeof currentStyle === 'string' && currentStyle.startsWith('http')) {
          // Already a full style URL (MapTiler or dev proxy) - don't replace
          needsReplacement = false;
        } else if (typeof currentStyle === 'object' && currentStyle.name === 'Streets Default v2') {
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
   * Inject CSS for dark theme + liquid glass on MapLibre controls (once per document)
   */
  private injectControlThemeStyles(): void {
    const styleId = 'gk-control-theme-style';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Dark liquid glass: control groups and containers */
      gk-map .maplibregl-ctrl-group,
      gk-map .mapboxgl-ctrl-group {
        background: rgba(18, 18, 22, 0.52) !important;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        border-radius: 10px !important;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
      }
      /* Individual control buttons (zoom, compass, fullscreen) */
      gk-map .maplibregl-ctrl,
      gk-map .mapboxgl-ctrl {
        background: transparent !important;
        border: none !important;
      }
      gk-map .maplibregl-ctrl button,
      gk-map .mapboxgl-ctrl button {
        background: transparent !important;
        border: none !important;
        width: 29px !important;
        height: 29px !important;
      }
      gk-map .maplibregl-ctrl button:hover,
      gk-map .mapboxgl-ctrl button:hover {
        background: rgba(255, 255, 255, 0.08) !important;
      }
      gk-map .maplibregl-ctrl button:active,
      gk-map .mapboxgl-ctrl button:active {
        background: rgba(255, 255, 255, 0.12) !important;
      }
      /* Dark theme: light icons (invert MapLibre default dark icons) */
      gk-map .maplibregl-ctrl-icon,
      gk-map .mapboxgl-ctrl-icon {
        filter: invert(1) brightness(1.1) contrast(0.9) !important;
        opacity: 0.92;
      }
      /* Scale bar: same glass treatment */
      gk-map .maplibregl-ctrl-scale,
      gk-map .mapboxgl-ctrl-scale {
        background: rgba(18, 18, 22, 0.52) !important;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        border-radius: 6px !important;
        padding: 4px 8px !important;
      }
      gk-map .maplibregl-ctrl-scale-inner,
      gk-map .mapboxgl-ctrl-scale-inner {
        border-color: rgba(255, 255, 255, 0.35) !important;
        color: rgba(255, 255, 255, 0.9) !important;
        font-size: 10px !important;
      }
    `;
    document.head.appendChild(style);
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

  // ============================================================================
  // URL Hash Sync
  // ============================================================================

  /**
   * Parse map state from URL hash
   * Supports format: #map=zoom/lat/lng/pitch/bearing
   * @returns Parsed state or null if not present/invalid
   */
  private parseUrlHashState(): {
    zoom: number;
    lat: number;
    lng: number;
    pitch: number;
    bearing: number;
  } | null {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#map=')) {
      return null;
    }

    try {
      const parts = hash.slice(5).split('/');
      if (parts.length < 3) return null;

      const zoom = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      const lng = parseFloat(parts[2]);
      const pitch = parts.length > 3 ? parseFloat(parts[3]) : 0;
      const bearing = parts.length > 4 ? parseFloat(parts[4]) : 0;

      // Validate values
      if (isNaN(zoom) || isNaN(lat) || isNaN(lng) || isNaN(pitch) || isNaN(bearing)) {
        return null;
      }

      // Validate ranges
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return null;
      }

      return { zoom, lat, lng, pitch, bearing };
    } catch {
      return null;
    }
  }

  /**
   * Update URL hash with current map state
   * Uses debouncing to avoid excessive URL updates during panning
   */
  private updateUrlHash(): void {
    if (!this.map || !this._urlSyncEnabled || this._isUpdatingFromUrl) {
      return;
    }

    // Clear existing debounce timer
    if (this._urlSyncDebounceTimer) {
      clearTimeout(this._urlSyncDebounceTimer);
    }

    // Debounce URL updates (150ms)
    this._urlSyncDebounceTimer = setTimeout(() => {
      if (!this.map) return;

      const map = this.map as any;
      const center = map.getCenter?.();
      const zoom = map.getZoom?.();
      const pitch = map.getPitch?.();
      const bearing = map.getBearing?.();

      if (!center || zoom === undefined) return;

      // Round values for cleaner URLs
      const roundedZoom = Math.round(zoom * 100) / 100;
      const roundedLat = Math.round(center.lat * 100000) / 100000;
      const roundedLng = Math.round(center.lng * 100000) / 100000;
      const roundedPitch = Math.round((pitch || 0) * 10) / 10;
      const roundedBearing = Math.round((bearing || 0) * 10) / 10;

      // Build hash string - only include pitch/bearing if non-zero
      let hashString = `#map=${roundedZoom}/${roundedLat}/${roundedLng}`;
      if (roundedPitch !== 0 || roundedBearing !== 0) {
        hashString += `/${roundedPitch}/${roundedBearing}`;
      }

      // Update URL without triggering navigation
      // Preserve existing history.state (required for Vue Router compatibility)
      const currentUrl = new URL(window.location.href);
      if (currentUrl.hash !== hashString) {
        history.replaceState(history.state, '', hashString);
      }
    }, 150);
  }

  /**
   * Apply URL hash state to the map
   */
  private applyUrlHashState(): void {
    const state = this.parseUrlHashState();
    if (!state || !this.map) return;

    this._isUpdatingFromUrl = true;
    const map = this.map as any;

    try {
      map.jumpTo?.({
        center: [state.lng, state.lat],
        zoom: state.zoom,
        pitch: state.pitch,
        bearing: state.bearing,
      });
    } finally {
      // Reset flag after a short delay to allow map events to settle
      setTimeout(() => {
        this._isUpdatingFromUrl = false;
      }, 100);
    }
  }

  /**
   * Set up URL hash synchronization
   * Called when map is ready and sync-url attribute is present
   */
  private setupUrlSync(): void {
    if (!this.hasAttribute('sync-url') || this._urlSyncEnabled) {
      return;
    }

    this._urlSyncEnabled = true;

    // Apply URL state if present (may have already been applied during init)
    // This handles cases where URL was changed while map was loading
    this.applyUrlHashState();

    // Listen for map movement to update URL
    this._mapMoveEndHandler = () => this.updateUrlHash();
    if (this.map) {
      this.map.on('moveend', this._mapMoveEndHandler);
    }

    // Listen for URL hash changes (e.g., browser back/forward)
    this._hashChangeHandler = () => {
      if (this._isUpdatingFromUrl) return;
      this.applyUrlHashState();
    };
    window.addEventListener('hashchange', this._hashChangeHandler);
  }

  /**
   * Clean up URL hash synchronization
   */
  private cleanupUrlSync(): void {
    if (this._urlSyncDebounceTimer) {
      clearTimeout(this._urlSyncDebounceTimer);
      this._urlSyncDebounceTimer = null;
    }

    if (this._mapMoveEndHandler && this.map) {
      this.map.off('moveend', this._mapMoveEndHandler);
      this._mapMoveEndHandler = null;
    }

    if (this._hashChangeHandler) {
      window.removeEventListener('hashchange', this._hashChangeHandler);
      this._hashChangeHandler = null;
    }

    this._urlSyncEnabled = false;
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

    // Handle sync-url toggle
    if (name === 'sync-url') {
      if (newValue !== null && this.isInitialized) {
        this.setupUrlSync();
      } else {
        this.cleanupUrlSync();
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
                layerId.startsWith('marker-') ||
                layerId.startsWith('isochrone-'))
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
              sourceId.startsWith('marker-') ||
              sourceId.startsWith('isochrone-')
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

  // ============================================================================
  // Child Element Tracking
  // ============================================================================

  /**
   * Initialize MutationObserver to track child element additions/removals
   */
  private _initializeChildTracking(): void {
    if (this._childObserver) return; // Already initialized

    // Track existing children
    Array.from(this.children).forEach((child) => {
      this._trackChild(child as HTMLElement);
    });

    // Set up MutationObserver to track future additions/removals
    this._childObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this._trackChild(node as HTMLElement);
          }
        });
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this._untrackChild(node as HTMLElement);
          }
        });
      });
    });

    this._childObserver.observe(this, {
      childList: true,
      subtree: false, // Only direct children
    });
  }

  /**
   * Clean up child tracking observer
   */
  private _cleanupChildTracking(): void {
    if (this._childObserver) {
      this._childObserver.disconnect();
      this._childObserver = null;
    }
    this._trackedChildren.clear();
  }

  /**
   * Track a child element by its tag name
   */
  private _trackChild(element: HTMLElement): void {
    const tagName = element.tagName.toLowerCase();
    if (!this._trackedChildren.has(tagName)) {
      this._trackedChildren.set(tagName, new Set());
    }
    this._trackedChildren.get(tagName)!.add(element);

    // Dispatch event
    this.dispatchEvent(
      new CustomEvent('child-added', {
        detail: { element, tagName },
        bubbles: false,
      })
    );
  }

  /**
   * Untrack a child element
   */
  private _untrackChild(element: HTMLElement): void {
    const tagName = element.tagName.toLowerCase();
    const set = this._trackedChildren.get(tagName);
    if (set) {
      set.delete(element);
      if (set.size === 0) {
        this._trackedChildren.delete(tagName);
      }
    }

    // Dispatch event
    this.dispatchEvent(
      new CustomEvent('child-removed', {
        detail: { element, tagName },
        bubbles: false,
      })
    );
  }

  /**
   * Get all child elements of a specific type
   */
  private _getChildrenByTag(tagName: string): HTMLElement[] {
    const set = this._trackedChildren.get(tagName.toLowerCase());
    return set ? Array.from(set) : [];
  }

  /**
   * Get all point elements
   * @param filter - Optional filter criteria
   */
  public getPoints(filter?: { visible?: boolean; id?: string }): PointElement[] {
    const points = this._getChildrenByTag('gk-point') as PointElement[];
    if (!filter) return points;

    return points.filter((point) => {
      if (filter.visible !== undefined) {
        const isVisible = point.getAttribute('visible') !== 'false';
        if (isVisible !== filter.visible) return false;
      }
      if (filter.id !== undefined) {
        const pointId = point.getAttribute('point-id');
        if (pointId !== filter.id) return false;
      }
      return true;
    });
  }

  /**
   * Get all polygon elements
   * @param filter - Optional filter criteria
   */
  public getPolygons(filter?: {
    visible?: boolean;
    dataAttribute?: { key: string; value: string };
  }): PolygonElement[] {
    const polygons = this._getChildrenByTag('gk-polygon') as PolygonElement[];
    if (!filter) return polygons;

    return polygons.filter((polygon) => {
      if (filter.visible !== undefined) {
        const isVisible = polygon.getAttribute('visible') !== 'false';
        if (isVisible !== filter.visible) return false;
      }
      if (filter.dataAttribute) {
        const attrValue = polygon.getAttribute(filter.dataAttribute.key);
        if (attrValue !== filter.dataAttribute.value) return false;
      }
      return true;
    });
  }

  /**
   * Get all isochrone elements
   * @param filter - Optional filter criteria
   */
  public getIsochrones(filter?: {
    visible?: boolean;
    selection?: boolean; // true = only selection, false = only travel time, undefined = all
    dataAttribute?: { key: string; value: string };
  }): IsochroneElement[] {
    const isochrones = this._getChildrenByTag('gk-isochrone') as IsochroneElement[];
    if (!filter) return isochrones;

    return isochrones.filter((iso) => {
      if (filter.visible !== undefined) {
        const isVisible = iso.getAttribute('visible') !== 'false';
        if (isVisible !== filter.visible) return false;
      }
      if (filter.selection !== undefined) {
        const isSelection = iso.getAttribute('data-venue-selection') === 'true';
        if (isSelection !== filter.selection) return false;
      }
      if (filter.dataAttribute) {
        const attrValue = iso.getAttribute(filter.dataAttribute.key);
        if (attrValue !== filter.dataAttribute.value) return false;
      }
      return true;
    });
  }

  /**
   * Remove all isochrones matching filter criteria
   * @param filter - Optional filter criteria
   */
  public removeIsochrones(filter?: { selection?: boolean; visible?: boolean }): void {
    const isochrones = this.getIsochrones(filter);
    isochrones.forEach((iso) => {
      iso.setAttribute('visible', 'false');
      iso.remove();
    });
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
        // Don't wait for 'idle' - it can delay by hundreds of ms; style load is enough for layers
        if (this.isInitialized) {
          this.hidePlaceholder();
        }
        // Resize and repaint so map fills container after scroll-back (container may have been zero-size when frozen)
        this.resizeAndRepaintMap();
        // Dispatch unfreeze event after reinitialization completes
        // Note: initializeMap() already dispatches gk-map-ready, but we also dispatch
        // gk-map-unfreeze to make the lifecycle explicit for components that need it
        this.dispatchEvent(
          new CustomEvent('gk-map-unfreeze', {
            detail: { map: this.map, element: this },
            bubbles: true,
          })
        );
        return true;
      }

      // If map already exists and is initialized, dispatch unfreeze event
      // This allows components to react to maps becoming active even if already initialized
      if (this.map && this.isInitialized) {
        this.hidePlaceholder();
        // Resize/repaint so map displays correctly when scrolled back into view
        this.resizeAndRepaintMap();
        // Dispatch unfreeze event so components can react (e.g., reload DMA polygons)
        this.dispatchEvent(
          new CustomEvent('gk-map-unfreeze', {
            detail: { map: this.map, element: this },
            bubbles: true,
          })
        );
        return true;
      }

      // Initialize the map
      await this.initializeMap();

      // Don't wait for 'idle' (tiles, etc.) - style load is enough for adding layers; speeds first load
      if (this.map) {
        if (this.isInitialized) {
          this.hidePlaceholder();
        }
        this.dispatchEvent(
          new CustomEvent('gk-map-unfreeze', {
            detail: { map: this.map, element: this },
            bubbles: true,
          })
        );
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

    // Dispatch freeze event before freezing
    this.dispatchEvent(
      new CustomEvent('gk-map-freeze', {
        detail: { map: this.map, element: this },
        bubbles: true,
      })
    );

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
          errorMessage.includes('Cannot read properties') ||
          errorMessage.includes('this._map is undefined') ||
          errorMessage.includes("reading 'off'");

        // Only log non-harmless errors or in development
        if (
          !isHarmlessError ||
          (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')
        ) {
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

    // Wait multiple frames to ensure WebGL context is fully released
    // Browsers release WebGL contexts asynchronously, so a single frame isn't enough
    // This prevents "Too many active WebGL contexts" warnings
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Additional 50ms delay to allow browser to fully garbage collect the context
          setTimeout(resolve, 50);
        });
      });
    });
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

    // Wait for container to have dimensions (e.g. after scroll-back, layout may not be done yet)
    const rect = this.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      await new Promise<void>((resolve) => {
        const check = () => {
          const r = this.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      });
    }

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
  public async whenStyleReady(timeout: number = 2000): Promise<void> {
    if (!this.map) {
      throw new Error('[gk-map] No map instance');
    }

    const map = this.map as any;

    // Check if already loaded
    if (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) {
      return;
    }

    // Also check if style object exists (some SDKs don't expose isStyleLoaded correctly)
    if (typeof map.getStyle === 'function') {
      const style = map.getStyle();
      if (style && typeof style === 'object') {
        return; // Style exists, assume it's ready
      }
    }

    return new Promise((resolve, _reject) => {
      const timeoutId = setTimeout(() => {
        map.off?.('style.load', handleStyleLoad);
        map.off?.('load', handleLoad);
        // Resolve anyway after timeout - map might be usable
        // Don't warn - this is expected if style is already loaded
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
   * Resize map to container and trigger repaint.
   * Call after unfreeze so the map fills the container when scrolled back into view.
   */
  private resizeAndRepaintMap(): void {
    if (!this.map) return;
    const map = this.map as { resize?: () => void; triggerRepaint?: () => void };
    requestAnimationFrame(() => {
      if (typeof map.resize === 'function') {
        map.resize();
      }
      if (typeof map.triggerRepaint === 'function') {
        map.triggerRepaint();
      }
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
      /** Property name to read color from each feature (takes precedence over color option) */
      colorProperty?: string;
      size?: number;
      opacity?: number;
      blur?: number;
      shadow?: boolean;
      shadowColor?: string;
      shadowBlur?: number;
      shadowOpacity?: number;
      glow?: boolean;
      glowColor?: string;
      glowOpacity?: number;
      glowBlur?: number;
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
    // Batch append using DocumentFragment for better performance
    if (polygons.length > 0) {
      const fragment = document.createDocumentFragment();
      polygons.forEach((polygon) => fragment.appendChild(polygon));
      this.appendChild(fragment);
    }
    return polygons.length;
  }

  /**
   * Add multiple polygons from GeoJSON features in a single batch operation
   * More efficient than calling addPolygonFromGeoJSON multiple times
   */
  public addPolygonsFromGeoJSONBatch(
    features: Array<{
      geojson: GeoJSON.Feature | GeoJSON.Geometry;
      options: Parameters<typeof MapElement.prototype.addPolygonFromGeoJSON>[1];
    }>
  ): number {
    const fragment = document.createDocumentFragment();
    let totalCount = 0;

    for (const { geojson, options } of features) {
      const polygons = PolygonElement.createFromGeoJSON(geojson, options);
      polygons.forEach((polygon) => fragment.appendChild(polygon));
      totalCount += polygons.length;
    }

    if (fragment.hasChildNodes()) {
      this.appendChild(fragment);
    }

    return totalCount;
  }

  // ============================================================================
  // Universal Source/Layer Management Utilities
  // ============================================================================

  /**
   * Update GeoJSON source data in place (avoids flicker from remove/add)
   * @param sourceId - Source ID to update
   * @param data - New GeoJSON FeatureCollection data
   * @returns true if update succeeded, false otherwise
   */
  public updateSourceData(sourceId: string, data: GeoJSON.FeatureCollection): boolean {
    const map = this.getMap();
    if (!map) return false;

    const source = map.getSource?.(sourceId);
    if (!source) {
      console.warn(`[gk-map] Source not found: ${sourceId}`);
      return false;
    }

    // Check if source has setData method (GeoJSON sources should have this)
    if (typeof (source as any).setData === 'function') {
      try {
        (source as any).setData(data);
        return true;
      } catch (error) {
        console.error(`[gk-map] Failed to update source data:`, error);
        return false;
      }
    }

    console.warn(`[gk-map] Source ${sourceId} does not support setData() method`);
    return false;
  }

  /**
   * Upsert (update or insert) a source and layer
   * If source exists, updates its data. If layer exists, ensures it's visible.
   * If either doesn't exist, creates them.
   * @param sourceId - Source ID
   * @param layerId - Layer ID
   * @param sourceData - GeoJSON FeatureCollection data
   * @param layerConfig - Layer configuration
   * @param beforeId - Optional layer ID to insert before
   * @returns true if operation succeeded, false otherwise
   */
  public upsertSourceLayer(
    sourceId: string,
    layerId: string,
    sourceData: GeoJSON.FeatureCollection,
    layerConfig: {
      type: string;
      paint?: Record<string, unknown>;
      layout?: Record<string, unknown>;
      filter?: unknown[];
      [key: string]: unknown;
    },
    beforeId?: string
  ): boolean {
    const map = this.getMap();
    if (!map) return false;

    const existingSource = map.getSource?.(sourceId);
    const existingLayer = map.getLayer?.(layerId);

    if (existingSource) {
      // Source exists - update data in place
      if (!this.updateSourceData(sourceId, sourceData)) {
        return false;
      }

      if (existingLayer) {
        // Layer exists - ensure visibility
        map.setLayoutProperty?.(layerId, 'visibility', 'visible');
        return true;
      } else {
        // Source exists but layer doesn't - add layer
        try {
          map.addLayer({ ...layerConfig, id: layerId, source: sourceId }, beforeId);
          return true;
        } catch (error) {
          console.error(`[gk-map] Failed to add layer ${layerId}:`, error);
          return false;
        }
      }
    } else {
      // Source doesn't exist - create both source and layer
      try {
        map.addSource(sourceId, {
          type: 'geojson',
          data: sourceData,
        });
        map.addLayer({ ...layerConfig, id: layerId, source: sourceId }, beforeId);
        return true;
      } catch (error) {
        console.error(`[gk-map] Failed to create source/layer ${sourceId}/${layerId}:`, error);
        return false;
      }
    }
  }

  /**
   * Remove source and its associated layers
   * @param sourceId - Source ID to remove
   * @returns true if removal succeeded, false otherwise
   */
  public removeSourceAndLayers(sourceId: string): boolean {
    const map = this.getMap();
    if (!map) return false;

    try {
      // Find all layers that use this source
      const style = (map as any).getStyle?.();
      if (style?.layers) {
        const layersToRemove = style.layers
          .filter((layer: any) => layer.source === sourceId)
          .map((layer: any) => layer.id);

        // Remove layers first
        for (const layerId of layersToRemove) {
          try {
            map.removeLayer(layerId);
          } catch {
            // Layer might not exist, continue
          }
        }
      }

      // Remove source
      map.removeSource(sourceId);
      return true;
    } catch (error) {
      console.error(`[gk-map] Failed to remove source ${sourceId}:`, error);
      return false;
    }
  }

  // ============================================================================
  // Universal Layer Visibility Helpers
  // ============================================================================

  /**
   * Set visibility for a single layer
   * @param layerId - Layer ID
   * @param visible - Whether layer should be visible
   * @returns true if operation succeeded, false otherwise
   */
  public setLayerVisibility(layerId: string, visible: boolean): boolean {
    const map = this.getMap();
    if (!map?.getLayer?.(layerId)) {
      return false;
    }

    try {
      map.setLayoutProperty?.(layerId, 'visibility', visible ? 'visible' : 'none');
      return true;
    } catch (error) {
      console.error(`[gk-map] Failed to set layer visibility:`, error);
      return false;
    }
  }

  /**
   * Set visibility for multiple layers at once
   * @param layerIds - Array of layer IDs
   * @param visible - Whether layers should be visible
   */
  public setLayersVisibility(layerIds: string[], visible: boolean): void {
    layerIds.forEach((id) => this.setLayerVisibility(id, visible));
  }

  /**
   * Check if a layer exists on the map
   * @param layerId - Layer ID to check
   * @returns true if layer exists, false otherwise
   */
  public hasLayer(layerId: string): boolean {
    const map = this.getMap();
    return !!map?.getLayer?.(layerId);
  }

  /**
   * Check if a source exists on the map
   * @param sourceId - Source ID to check
   * @returns true if source exists, false otherwise
   */
  public hasSource(sourceId: string): boolean {
    const map = this.getMap();
    return !!map?.getSource?.(sourceId);
  }

  /**
   * Get GeoJSON data from a source
   * Handles both _data and _geojson internal properties
   * @param sourceId - Source ID
   * @returns GeoJSON FeatureCollection data or null if not found
   */
  public getSourceData(sourceId: string): GeoJSON.FeatureCollection | null {
    const map = this.getMap();
    if (!map) return null;

    const source = map.getSource?.(sourceId);
    if (!source || (source as any).type !== 'geojson') return null;

    const data = (source as any)._data || (source as any)._geojson;
    if (!data?.features) return null;

    return data as GeoJSON.FeatureCollection;
  }

  /**
   * Find a feature by ID in a source
   * @param sourceId - Source ID to search
   * @param featureId - Feature ID to find (checks properties.id, properties.slug, etc.)
   * @param idProperties - Optional array of property names to check for ID (default: ['id', 'slug'])
   * @returns Feature if found, null otherwise
   */
  public findFeatureById(
    sourceId: string,
    featureId: string,
    idProperties: string[] = ['id', 'slug']
  ): GeoJSON.Feature | null {
    const data = this.getSourceData(sourceId);
    if (!data) return null;

    return (
      data.features.find((f: GeoJSON.Feature) => {
        if (!f.properties) return false;
        return idProperties.some((prop) => f.properties?.[prop] === featureId);
      }) || null
    );
  }

  /**
   * Get full feature properties from source
   * MapLibre may return limited properties from queryRenderedFeatures,
   * so this looks up the full feature from the source
   * @param sourceId - Source ID
   * @param partialProperties - Partial properties from queryRenderedFeatures
   * @param idProperties - Optional array of property names to check for ID
   * @returns Full feature properties or partial if not found
   */
  public getFullFeatureProperties(
    sourceId: string,
    partialProperties: Record<string, unknown>,
    idProperties: string[] = ['id', 'slug']
  ): Record<string, unknown> {
    // Try to find feature ID from partial properties
    const featureId = idProperties.find((prop) => partialProperties[prop]) as string | undefined;

    if (!featureId || !partialProperties[featureId]) {
      return partialProperties;
    }

    const fullFeature = this.findFeatureById(
      sourceId,
      String(partialProperties[featureId]),
      idProperties
    );

    if (fullFeature?.properties) {
      return fullFeature.properties;
    }

    return partialProperties;
  }

  /**
   * Update selection state in a GeoJSON source
   * Sets a selection property on the selected feature, removes from others
   * @param sourceId - Source ID to update
   * @param selectedId - Feature ID to select (null to clear selection)
   * @param selectionProperty - Property name to use for selection (default: '__selected')
   * @param idProperties - Optional array of property names to check for ID
   * @returns true if update was successful
   */
  public updateFeatureSelection(
    sourceId: string,
    selectedId: string | null,
    selectionProperty: string = '__selected',
    idProperties: string[] = ['id', 'slug']
  ): boolean {
    const data = this.getSourceData(sourceId);
    if (!data) return false;

    try {
      let foundSelected = false;
      const newFeatures = data.features.map((f: GeoJSON.Feature) => {
        // Create a new feature object to trigger reactivity
        const newFeature = JSON.parse(JSON.stringify(f)) as GeoJSON.Feature;

        if (!newFeature.properties) {
          newFeature.properties = {};
        }

        // Check if this is the selected feature
        const isSelected =
          selectedId !== null &&
          idProperties.some((prop) => newFeature.properties?.[prop] === selectedId);

        if (isSelected) {
          foundSelected = true;
          newFeature.properties[selectionProperty] = true;
        } else {
          // Remove selection property if present
          delete newFeature.properties[selectionProperty];
        }

        return newFeature;
      });

      if (selectedId && !foundSelected) {
        console.warn(`[gk-map] Feature ${selectedId} not found in source ${sourceId}`);
      }

      // Update source data
      const success = this.updateSourceData(sourceId, {
        type: 'FeatureCollection',
        features: newFeatures,
      });

      // Force repaint to show selection
      if (success) {
        const map = this.getMap();
        if (map && typeof map.triggerRepaint === 'function') {
          map.triggerRepaint();
        } else if (map && typeof (map as any).repaint === 'function') {
          (map as any).repaint();
        }
      }

      return success;
    } catch (error) {
      console.error(`[gk-map] Failed to update selection for source: ${sourceId}`, error);
      return false;
    }
  }

  /**
   * Update layer filter expression
   * Universal method to apply MapLibre filter expressions to layers
   * @param layerId - Layer ID
   * @param filterExpression - MapLibre filter expression
   * @returns true if update succeeded, false otherwise
   */
  public setLayerFilter(layerId: string, filterExpression: unknown[]): boolean {
    const map = this.getMap();
    if (!map?.getLayer || !(map as any).setFilter) return false;

    try {
      if (map.getLayer(layerId)) {
        (map as any).setFilter(layerId, filterExpression);
        return true;
      }
    } catch (error) {
      console.warn(`[gk-map] Failed to set filter for layer: ${layerId}`, error);
    }

    return false;
  }

  // ============================================================================
  // Control Management
  // ============================================================================

  /**
   * Add a control to the map element
   * Creates a gk-control-{type} element and appends it to this map
   * @param config - Control configuration
   * @returns The created control element or null if control type not found
   */
  public addControl(config: {
    /** Control type (e.g., 'navigation', 'fullscreen', 'scale', 'geolocate') */
    type: string;
    /** Control position (e.g., 'top-right', 'bottom-left') */
    position?: string;
    /** Additional attributes to set on the control */
    attributes?: Record<string, string>;
  }): HTMLElement | null {
    const ControlClass = customElements.get(`gk-control-${config.type}`);
    if (!ControlClass) {
      console.warn(`[gk-map] Control type not found: gk-control-${config.type}`);
      return null;
    }

    const control = new ControlClass() as HTMLElement;

    // Set position if provided
    if (config.position) {
      control.setAttribute('position', config.position);
    }

    // Set additional attributes
    if (config.attributes) {
      for (const [key, value] of Object.entries(config.attributes)) {
        control.setAttribute(key, value);
      }
    }

    this.appendChild(control);
    return control;
  }

  /**
   * Add multiple controls at once
   * @param configs - Array of control configurations
   * @returns Array of created control elements (nulls filtered out)
   */
  public addControls(
    configs: Array<{
      type: string;
      position?: string;
      attributes?: Record<string, string>;
    }>
  ): HTMLElement[] {
    return configs
      .map((config) => this.addControl(config))
      .filter((control): control is HTMLElement => control !== null);
  }

  // ============================================================================
  // Factory Method for Programmatic Creation
  // ============================================================================

  /**
   * Create a MapElement programmatically with options
   * @param options - Map creation options
   * @returns New MapElement instance
   */
  public static create(
    options: {
      id?: string;
      lat?: number | string;
      lng?: number | string;
      zoom?: number | string;
      minZoom?: number | string;
      maxZoom?: number | string;
      pitch?: number | string;
      maxPitch?: number | string;
      bearing?: number | string;
      mapStyle?: string;
      provider?: string;
      apiKey?: string;
      interactive?: boolean;
      autoHideControls?: boolean;
      lazy?: boolean | string;
      attributes?: Record<string, string>;
      styles?: Partial<CSSStyleDeclaration>;
    } = {}
  ): MapElement {
    const map = new MapElement();

    // Set ID if provided
    if (options.id) {
      map.id = options.id;
    }

    // Set position attributes
    if (options.lat !== undefined) {
      map.setAttribute('lat', String(options.lat));
    }
    if (options.lng !== undefined) {
      map.setAttribute('lng', String(options.lng));
    }
    if (options.zoom !== undefined) {
      map.setAttribute('zoom', String(options.zoom));
    }
    if (options.minZoom !== undefined) {
      map.setAttribute('min-zoom', String(options.minZoom));
    }
    if (options.maxZoom !== undefined) {
      map.setAttribute('max-zoom', String(options.maxZoom));
    }
    if (options.pitch !== undefined) {
      map.setAttribute('pitch', String(options.pitch));
    }
    if (options.maxPitch !== undefined) {
      map.setAttribute('max-pitch', String(options.maxPitch));
    }
    if (options.bearing !== undefined) {
      map.setAttribute('bearing', String(options.bearing));
    }

    // Set style
    if (options.mapStyle) {
      map.setAttribute('map-style', options.mapStyle);
    }

    // Set provider and API key
    if (options.provider) {
      map.setAttribute('provider', options.provider);
    }
    if (options.apiKey) {
      map.setAttribute('api-key', options.apiKey);
    }

    // Set boolean attributes
    if (options.interactive !== undefined) {
      map.setAttribute('interactive', String(options.interactive));
    }
    if (options.autoHideControls) {
      map.setAttribute('auto-hide-controls', '');
    }
    if (options.lazy !== undefined) {
      map.setAttribute('lazy', String(options.lazy));
    }

    // Set additional attributes
    if (options.attributes) {
      for (const [key, value] of Object.entries(options.attributes)) {
        map.setAttribute(key, value);
      }
    }

    // Apply additional styles
    if (options.styles) {
      Object.assign(map.style, options.styles);
    }

    return map;
  }

  /**
   * Create a MapElement with controls in one call
   * Convenience factory that combines create() with addControls()
   * @param options - Map creation options (same as create())
   * @param controls - Array of control configurations to add
   * @returns New MapElement instance with controls added
   */
  public static createWithControls(
    options: Parameters<typeof MapElement.create>[0] = {},
    controls: Array<{
      type: string;
      position?: string;
      attributes?: Record<string, string>;
    }> = []
  ): MapElement {
    const map = MapElement.create(options);

    // Add controls
    for (const controlConfig of controls) {
      map.addControl(controlConfig);
    }

    return map;
  }

  // ============================================================================
  // Batch GeoJSON Operations
  // ============================================================================

  /**
   * Add features from a GeoJSON FeatureCollection
   * Automatically handles points, polygons, and polylines
   * @param geojson - GeoJSON FeatureCollection
   * @param options - Styling and behavior options
   * @returns Object with counts of each feature type added
   */
  public addFeaturesFromGeoJSON(
    geojson: GeoJSON.FeatureCollection,
    options: {
      points?: {
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
      };
      polygons?: {
        fillColor?: string;
        fillOpacity?: number;
        strokeColor?: string;
        strokeWidth?: number;
        strokeOpacity?: number;
        visible?: boolean;
        simplify?: boolean;
        maxPoints?: number;
      };
      polylines?: {
        color?: string;
        width?: number;
        opacity?: number;
      };
    } = {}
  ): { points: number; polygons: number; polylines: number } {
    const counts = { points: 0, polygons: 0, polylines: 0 };

    // Separate features by type
    const pointFeatures: GeoJSON.Feature[] = [];
    const polygonFeatures: GeoJSON.Feature[] = [];
    const polylineFeatures: GeoJSON.Feature[] = [];

    for (const feature of geojson.features) {
      if (!feature.geometry) continue;

      switch (feature.geometry.type) {
        case 'Point':
        case 'MultiPoint':
          pointFeatures.push(feature);
          break;
        case 'Polygon':
        case 'MultiPolygon':
          polygonFeatures.push(feature);
          break;
        case 'LineString':
        case 'MultiLineString':
          polylineFeatures.push(feature);
          break;
        default:
          console.warn(`[gk-map] Unsupported geometry type: ${feature.geometry.type}`);
      }
    }

    // Add points
    if (pointFeatures.length > 0 && options.points) {
      const pointCollection: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: pointFeatures,
      };
      counts.points = this.addPointsFromGeoJSON(pointCollection, options.points);
    }

    // Add polygons
    for (const polygonFeature of polygonFeatures) {
      if (options.polygons) {
        const added = this.addPolygonFromGeoJSON(polygonFeature, options.polygons);
        counts.polygons += added;
      }
    }

    // Polylines not yet implemented in geokit, but structure is ready
    if (polylineFeatures.length > 0) {
      console.warn(
        `[gk-map] Polylines not yet supported, ${polylineFeatures.length} features skipped`
      );
    }

    return counts;
  }
}

// Register custom element
if (!customElements.get('gk-map')) {
  customElements.define('gk-map', MapElement);
}
