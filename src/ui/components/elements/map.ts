/**
 * Map Component
 *
 * Main map container component
 *
 * Usage:
 * <mapi-map lat="40.7128" lng="-74.006" zoom="10" style="streets"></mapi-map>
 */

import { BaseElement } from '../base-element';
import { registerUIProvider, setUIProvider } from '../../providers/registry';
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
    'hide-attribution',
    'provider',
  ];

  private _controlsVisible: boolean = true;
  private _mouseEnterHandler: (() => void) | null = null;
  private _mouseLeaveHandler: (() => void) | null = null;

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
    // Prevent re-initialization if map already exists (important for map pool reuse)
    // When maps are moved between cards, connectedCallback can be called again,
    // but we should reuse the existing map instance to avoid creating new WebGL contexts
    if (!this.isInitialized && !this.map) {
      await this.initializeMap();
    } else if (this.map && !this.isInitialized) {
      // Map exists but not marked as initialized - mark it as initialized
      // This can happen if the map was created but the load event hasn't fired yet
      this.isInitialized = true;
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
    try {
      // Get provider name from attribute or try auto-detection
      const providerName = this.getAttribute('provider');
      const apiKey = this.getAttribute('api-key');
      const accessToken = this.getAttribute('access-token');
      
      let provider;
      
      // If provider is explicitly specified, use it
      if (providerName) {
        const { getProviderByName, registerUIProvider } = await import('../../providers/registry');
        let existingProvider = await getProviderByName(providerName).catch(() => null);
        
        if (!existingProvider) {
          // Provider not registered, register and initialize it
          if (providerName === 'maptiler') {
            // Load MapTiler CSS dynamically
            // @ts-expect-error - CSS imports are handled by Vite at build time
            await import('@maptiler/sdk/dist/maptiler-sdk.css');
            
            registerUIProvider('maptiler', new MapTilerUIProvider());
            // Only pass config if explicitly provided via attributes
            provider = await getProviderByName('maptiler', apiKey ? { apiKey } : undefined);
          } else if (providerName === 'mapbox') {
            // Load Mapbox CSS dynamically
            // @ts-expect-error - CSS imports are handled by Vite at build time
            await import('mapbox-gl/dist/mapbox-gl.css');
            
            const { MapboxUIProvider } = await import('../../providers/mapbox-provider');
            registerUIProvider('mapbox', new MapboxUIProvider());
            // Only pass config if explicitly provided via attributes
            const token = accessToken || (import.meta as any).env?.MAPBOX_ACCESS_TOKEN;
            provider = await getProviderByName('mapbox', token ? { accessToken: token } : undefined);
          } else {
            throw new Error(`Unknown provider: ${providerName}. Supported: maptiler, mapbox`);
          }
        } else {
          // Initialize existing provider with config (if provided)
          let config: { accessToken?: string } | { apiKey?: string } | undefined = undefined;
          if (providerName === 'mapbox') {
            const token = accessToken || (import.meta as any).env?.MAPBOX_ACCESS_TOKEN;
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

      const options = {
        lat: parseFloat(this.getAttribute('lat') || '0'),
        lng: parseFloat(this.getAttribute('lng') || '0'),
        zoom: parseFloat(this.getAttribute('zoom') || '2'),
        pitch: parseFloat(this.getAttribute('pitch') || '0'),
        bearing: parseFloat(this.getAttribute('bearing') || '0'),
        style: this.getAttribute('style') || undefined,
        interactive: this.getAttribute('interactive') !== 'false',
      };

      this.map = await provider.createMap(container, options);

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
        if (this.map) {
          this.map.once('idle', () => {
            this.setupAutoHideControls();
            this.dispatchEvent(
              new CustomEvent('mapi-ready', {
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
            // Wait for idle to ensure internal control system is initialized
            if (this.map) {
              this.map.once('idle', () => {
                this.setupAutoHideControls();
                this.dispatchEvent(
                  new CustomEvent('mapi-ready', {
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
    }
  }

  /**
   * Set up hide attribution behavior
   * When enabled, hides all attribution elements including logos
   */
  private setupHideAttribution(): void {
    if (!this.hasAttribute('hide-attribution')) return;

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
      gk-map:not(.gk-controls-hidden) .mapboxgl-ctrl {
        opacity: 1;
        pointer-events: auto;
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
