/**
 * Geokit Isochrone Component
 *
 * Displays isochrone (travel time) polygons on the map
 * Supports both smooth polygon rendering and H3 hexagon rendering
 *
 * Usage:
 * <gk-isochrone lat="40.7128" lng="-74.0060" time="15" mode="driving"></gk-isochrone>
 * <gk-isochrone lat="40.7128" lng="-74.0060" time="15" mode="driving" render="h3" h3-resolution="7"></gk-isochrone>
 */

import { MapChildElement } from '../map-child-element';
import { getProviderForCapability } from '../../../api/providers/registry';
import { polygonToH3, h3SetToMultiPolygon } from '../../../utils/h3';
import { smoothFeatureCollection } from '../../../utils/smoothing';
import { debug } from '../../utils/logger';
import { getCSSVariable, getCSSVariableNumber } from '../../utils/theme';
import type { Polygon } from '../../../types';

export interface IsochroneOptions {
  lat: number;
  lng: number;
  time: number; // in minutes
  mode?: 'driving' | 'walking' | 'cycling';
  color?: string;
  opacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  /** Pre-computed isochrone data (GeoJSON FeatureCollection) - skips API fetch when provided */
  data?: GeoJSON.FeatureCollection;
}

export class IsochroneElement extends MapChildElement {
  static observedAttributes = [
    'lat',
    'lng',
    'time',
    'mode',
    'color',
    'opacity',
    'stroke-color',
    'stroke-width',
    'visible',
    'render', // 'polygon' or 'h3'
    'h3-resolution', // H3 resolution (0-15, default 7)
    'data', // Pre-computed isochrone data (JSON string of GeoJSON FeatureCollection)
    'before-layer', // Layer ID to insert isochrone layers before (consumer controls ordering)
  ];

  private sourceId: string | null = null;
  private lineLayerId: string | null = null;
  private fillLayerId: string | null = null;
  private currentCacheKey: string | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private isElementVisible: boolean | null = true; // Default to true for immediate rendering
  private hasUpgradedResolution: boolean = false; // Track if resolution has been upgraded
  private mapInteractionListeners: Array<() => void> = []; // Store cleanup functions for map event listeners
  private upgradeDebounceTimer: number | null = null; // Debounce timer for resolution upgrades
  private pendingUpgrade: boolean = false; // Track if an upgrade is pending
  private readonly UPGRADE_DEBOUNCE_MS = 500; // Wait 500ms after interaction stops before upgrading
  private readonly MIN_ZOOM_FOR_UPGRADE = 8; // Convert to hexagons at zoom 8+

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected override async onMapReady(): Promise<void> {
    // By the time onMapReady is called, the parent gk-map is fully initialized
    // No need to wait for style - it's already loaded
    if (!this.map) {
      console.warn('[Isochrone] onMapReady called but no map instance');
      return;
    }

    // Setup visibility observer to only fetch when element is visible
    this.setupVisibilityObserver();

    // Fetch immediately - map is ready, no need to wait
    this.fetchAndRenderIsochrone();

    // Setup map interaction listeners to upgrade resolution on zoom/interaction
    this.setupMapInteractionListeners();
  }

  /** Re-add isochrone layers after map style change (e.g. theme toggle). */
  protected override onStyleLoad(): void {
    if (!this.map) return;
    // Clear cache so we re-add layers even though data is unchanged (style replace removed them)
    this.currentCacheKey = null;
    // We're only called after gk-map-style-load (style already replaced). Use double rAF to avoid
    // MapTiler coalesceChanges; don't use waitForStyleLoaded (style.load may have already fired).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.fetchAndRenderIsochrone();
      });
    });
  }

  // Cleanup function for hover handlers (stored so we can remove on teardown)
  private hoverCleanup: (() => void) | null = null;

  /**
   * Setup hover handlers on the fill layer so consumers receive
   * `gk-isochrone-hover` / `gk-isochrone-hover-end` events.
   */
  private setupHoverHandlers(): void {
    if (!this.map || !this.fillLayerId) return;
    if (!this.map.getLayer?.(this.fillLayerId)) return;

    // Clean up previous handlers (idempotent)
    this.cleanupHoverHandlers();

    const fillLayer = this.fillLayerId;

    const onMouseEnter = (e: any): void => {
      const canvas = this.map?.getCanvas?.();
      if (canvas?.style) canvas.style.cursor = 'pointer';

      this.dispatchEvent(
        new CustomEvent('gk-isochrone-hover', {
          detail: {
            lngLat: e.lngLat,
            features: e.features,
            map: this.map,
            element: this,
          },
          bubbles: true,
          cancelable: true,
        })
      );
    };

    const onMouseLeave = (): void => {
      const canvas = this.map?.getCanvas?.();
      if (canvas?.style) canvas.style.cursor = '';

      this.dispatchEvent(
        new CustomEvent('gk-isochrone-hover-end', {
          detail: {
            map: this.map,
            element: this,
          },
          bubbles: true,
          cancelable: true,
        })
      );
    };

    this.map.on('mouseenter', fillLayer, onMouseEnter);
    this.map.on('mouseleave', fillLayer, onMouseLeave);

    this.hoverCleanup = () => {
      try {
        this.map?.off?.('mouseenter', fillLayer, onMouseEnter);
        this.map?.off?.('mouseleave', fillLayer, onMouseLeave);
      } catch {
        // Map may already be destroyed
      }
    };
  }

  private cleanupHoverHandlers(): void {
    if (this.hoverCleanup) {
      this.hoverCleanup();
      this.hoverCleanup = null;
    }
  }

  /**
   * Setup listeners for map interactions (zoom, pan, etc.) to upgrade resolution
   * Uses debouncing and zoom-level checks to optimize performance
   */
  private setupMapInteractionListeners(): void {
    if (!this.map) return;

    // Clean up any existing listeners
    this.cleanupMapInteractionListeners();

    const scheduleUpgrade = () => {
      // Skip if already upgraded or not H3 mode
      if (this.hasUpgradedResolution || this.render !== 'h3') {
        return;
      }

      // Check zoom level - only convert to hexagons if zoomed in enough
      const currentZoom = (this.map as { getZoom?: () => number })?.getZoom?.() || 0;
      if (currentZoom < this.MIN_ZOOM_FOR_UPGRADE) {
        return; // Too zoomed out, keep raw polygon
      }

      // Check if element is visible
      if (this.isElementVisible === false) {
        return; // Don't upgrade off-screen isochrones
      }

      // Clear existing debounce timer
      if (this.upgradeDebounceTimer !== null) {
        clearTimeout(this.upgradeDebounceTimer);
        this.upgradeDebounceTimer = null;
      }

      // Mark that we have a pending upgrade
      this.pendingUpgrade = true;

      // Debounce: wait for interaction to settle before converting to hexagons
      this.upgradeDebounceTimer = window.setTimeout(() => {
        this.upgradeDebounceTimer = null;

        // Double-check conditions before upgrading
        if (this.hasUpgradedResolution || this.render !== 'h3' || !this.map) {
          this.pendingUpgrade = false;
          return;
        }

        const targetResolution = this.h3Resolution;
        // Convert from raw polygon to H3 hexagons
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(
            () => {
              this.pendingUpgrade = false;
              this.upgradeResolution(targetResolution);
            },
            { timeout: 2000 } // Start upgrade after 2 seconds max if no idle time
          );
        } else {
          // Fallback: upgrade immediately (but still debounced)
          this.pendingUpgrade = false;
          this.upgradeResolution(targetResolution);
        }
      }, this.UPGRADE_DEBOUNCE_MS);
    };

    // Upgrade on zoom (use 'zoomend' to avoid firing on every zoom step)
    const zoomListener = () => scheduleUpgrade();
    if (this.map.on) {
      this.map.on('zoomend', zoomListener);
      this.mapInteractionListeners.push(() => {
        if (this.map?.off) this.map.off('zoomend', zoomListener);
      });
    }

    // Upgrade on move/pan (use 'moveend' to avoid firing on every move step)
    const moveListener = () => scheduleUpgrade();
    if (this.map.on) {
      this.map.on('moveend', moveListener);
      this.mapInteractionListeners.push(() => {
        if (this.map?.off) this.map.off('moveend', moveListener);
      });
    }

    // Upgrade on click/interaction (immediate, no debounce for clicks)
    const clickListener = () => {
      if (this.hasUpgradedResolution || this.render !== 'h3') {
        return;
      }

      const currentZoom = (this.map as { getZoom?: () => number })?.getZoom?.() || 0;
      if (currentZoom < this.MIN_ZOOM_FOR_UPGRADE) {
        return;
      }

      // Clear debounce timer since user explicitly clicked
      if (this.upgradeDebounceTimer !== null) {
        clearTimeout(this.upgradeDebounceTimer);
        this.upgradeDebounceTimer = null;
      }

      const targetResolution = this.h3Resolution;
      // Convert from raw polygon to H3 hexagons on click
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(
          () => {
            this.upgradeResolution(targetResolution);
          },
          { timeout: 1000 } // Faster timeout for explicit clicks
        );
      } else {
        this.upgradeResolution(targetResolution);
      }
    };
    if (this.map.on) {
      this.map.on('click', clickListener);
      this.mapInteractionListeners.push(() => {
        if (this.map?.off) this.map.off('click', clickListener);
      });
    }
  }

  /**
   * Clean up map interaction listeners
   */
  private cleanupMapInteractionListeners(): void {
    this.mapInteractionListeners.forEach((cleanup) => cleanup());
    this.mapInteractionListeners = [];

    // Clear debounce timer
    if (this.upgradeDebounceTimer !== null) {
      clearTimeout(this.upgradeDebounceTimer);
      this.upgradeDebounceTimer = null;
    }

    this.pendingUpgrade = false;
  }

  /**
   * Setup IntersectionObserver to track element visibility
   * Only fetches isochrone data when element is actually visible
   */
  private setupVisibilityObserver(): void {
    // Check if element is in a visible map card
    const mapCard = this.closest('.map-card');
    if (mapCard) {
      // Check initial visibility synchronously (best effort)
      // Be more lenient - if card exists and is not explicitly hidden, assume visible
      // The IntersectionObserver will correct this if wrong
      const cardRect = mapCard.getBoundingClientRect();
      const cardStyle = window.getComputedStyle(mapCard);
      const isCardHidden =
        cardStyle.visibility === 'hidden' ||
        cardStyle.display === 'none' ||
        cardRect.width === 0 ||
        cardRect.height === 0;

      // Default to null (unknown) unless explicitly hidden
      // IntersectionObserver will update this more accurately
      // null means "try to load" - only false prevents loading
      this.isElementVisible = isCardHidden ? false : null;

      // Use IntersectionObserver to watch for visibility changes
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const wasVisible = this.isElementVisible;
            this.isElementVisible = entry.isIntersecting;

            // If element just became visible and we haven't fetched yet, fetch now
            // Store map reference locally to avoid race conditions
            const map = this.map;
            if (this.isElementVisible && !wasVisible && map && this.sourceId) {
              // Check if we already have a source (already fetched)
              // Double-check map is still valid and has getSource method
              if (map && typeof map.getSource === 'function') {
                try {
                  const hasSource = map.getSource(this.sourceId);
                  if (!hasSource) {
                    this.waitForStyleLoaded(() => {
                      this.fetchAndRenderIsochrone();
                    });
                  }
                } catch (error) {
                  // Map might be in invalid state, try to fetch anyway
                  debug.warn('[Isochrone] Error checking source, attempting fetch:', error);
                  this.waitForStyleLoaded(() => {
                    this.fetchAndRenderIsochrone();
                  });
                }
              } else {
                // Map exists but getSource not available yet, try to fetch anyway
                this.waitForStyleLoaded(() => {
                  this.fetchAndRenderIsochrone();
                });
              }
            }
          });
        },
        {
          root: null,
          rootMargin: '200px', // Start loading slightly before visible
          threshold: 0,
        }
      );

      // Observe the map card for better visibility detection
      this.intersectionObserver.observe(mapCard);
    } else {
      // No map card parent, assume visible (null = try to load)
      this.isElementVisible = null;
    }
  }

  override async connectedCallback() {
    await super.connectedCallback();

    if (this.isInitialized) return;

    // If a stable source-id attribute is set, use it instead of a random UUID.
    // This allows the host app to pre-create the source + layers (with empty data)
    // during map setup, so the isochrone only ever calls setData() — never
    // addSource/addLayer — which avoids MapTiler style recalculation that can
    // make other circle layers partially vanish.
    const stableId = this.getAttribute('source-id');
    if (stableId) {
      this.sourceId = stableId;
      this.fillLayerId = `polygon-fill-${stableId}`;
      this.lineLayerId = `polygon-stroke-${stableId}`;
    } else {
      const uuid = crypto.randomUUID();
      this.sourceId = `isochrone-${uuid}`;
      this.fillLayerId = `polygon-fill-isochrone-${uuid}`;
      this.lineLayerId = `polygon-stroke-isochrone-${uuid}`;
    }

    this.isInitialized = true;
  }

  /**
   * Determine which layer to insert isochrone layers before.
   * 1) Consumer-provided `before-layer` attribute (explicit ordering).
   * 2) First circle layer in the style (generic fallback).
   */
  private findBeforeLayer(): string | undefined {
    // Prefer explicit before-layer attribute set by the consumer
    const explicit = this.beforeLayer;
    if (explicit && this.map?.getLayer?.(explicit)) return explicit;

    if (!this.map) return undefined;
    try {
      const style = (
        this.map as { getStyle?: () => { layers?: Array<{ id?: string; type?: string }> } }
      ).getStyle?.();
      if (!style?.layers?.length) return undefined;

      for (const layer of style.layers) {
        if (layer.type === 'circle') return layer.id;
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  private async fetchAndRenderIsochrone(): Promise<void> {
    if (!this.map) return;
    if (!this.visible) return;

    // Ensure IDs are initialized (in case connectedCallback hasn't completed)
    if (!this.sourceId) {
      const stableId = this.getAttribute('source-id');
      if (stableId) {
        this.sourceId = stableId;
        this.fillLayerId = `polygon-fill-${stableId}`;
        this.lineLayerId = `polygon-stroke-${stableId}`;
      } else {
        const uuid = crypto.randomUUID();
        this.sourceId = `isochrone-${uuid}`;
        this.fillLayerId = `polygon-fill-isochrone-${uuid}`;
        this.lineLayerId = `polygon-stroke-isochrone-${uuid}`;
      }
    }

    const lat = parseFloat(this.getAttribute('lat') || '');
    const lng = parseFloat(this.getAttribute('lng') || '');

    const time = this.time;
    const mode = this.mode;

    if (isNaN(lat) || isNaN(lng)) {
      console.warn('[Isochrone] Invalid coordinates:', { lat, lng });
      return;
    }

    // Check if stored data matches current settings
    // Stored data is tagged with the time/mode it was set for
    const storedData = this.storedData;
    const storedDataTime = (this as any)._storedDataTime;
    const storedDataMode = (this as any)._storedDataMode;
    const canUseStoredData =
      storedData !== null && storedDataTime === time && storedDataMode === mode;

    // Create cache key (include 'stored' suffix when using pre-computed data)
    const cacheKey = `${lat},${lng},${time},${mode}${canUseStoredData ? ':stored' : ''}`;
    if (cacheKey === this.currentCacheKey) {
      return;
    }

    this.currentCacheKey = cacheKey;

    let result: GeoJSON.FeatureCollection | null = null;

    if (canUseStoredData) {
      // Use pre-computed data - skip API fetch (settings match what was stored)
      result = storedData;
    } else {
      // Get API provider that supports isochrone (optional when app uses stored data only)
      const provider = getProviderForCapability('isochrone');
      if (!provider) {
        return;
      }

      try {
        // Fetch isochrone data from API
        result = (await provider.fetchIsochrone?.({
          lat,
          lng,
          minutes: [time],
          mode,
        })) as GeoJSON.FeatureCollection | null;
      } catch (error) {
        const errorMsg = `[Isochrone] ✗ Failed to fetch isochrone for ${lat.toFixed(6)},${lng.toFixed(6)}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg, error);
        this.dispatchEvent(
          new CustomEvent('isochrone-error', {
            detail: {
              error,
              lat,
              lng,
              time,
              mode,
              element: this,
            },
            bubbles: true,
          })
        );
        return;
      }
    }

    try {
      // Store original API result for resolution upgrades
      // We need the original polygon to convert to higher resolution later
      (this as any)._originalIsochroneData = result;

      if (!result || !result.features || result.features.length === 0) {
        debug.warn(`[Isochrone] No features returned for ${lat.toFixed(6)},${lng.toFixed(6)}`);
        this.dispatchEvent(
          new CustomEvent('isochrone-error', {
            detail: {
              error: new Error('No features returned from API'),
              lat,
              lng,
              time,
              mode,
              element: this,
            },
            bubbles: true,
          })
        );
        return;
      }

      // For H3 mode: start with raw polygon for instant visibility
      // Convert to hexagons only when user zooms/interacts
      // This provides fastest initial rendering
      // For polygon mode: apply Chaikin smoothing for smoother edges
      const processedData =
        this.render === 'polygon'
          ? smoothFeatureCollection(3)(result) // 3 iterations for smooth curves
          : result;
      // Don't convert to H3 on initial render - use raw polygon for speed
      // Conversion to H3 will happen on map interaction via upgradeResolution()

      // Ensure IDs exist (generated once per element lifetime)
      if (!this.sourceId) {
        const stableId = this.getAttribute('source-id');
        if (stableId) {
          this.sourceId = stableId;
          this.fillLayerId = `polygon-fill-${stableId}`;
          this.lineLayerId = `polygon-stroke-${stableId}`;
        } else {
          const uuid = crypto.randomUUID();
          this.sourceId = `isochrone-${uuid}`;
          this.fillLayerId = `polygon-fill-isochrone-${uuid}`;
          this.lineLayerId = `polygon-stroke-isochrone-${uuid}`;
        }
      }

      if (!this.map) return;

      // Reuse existing source if it exists — just update data in place (no layer add/remove).
      // This avoids triggering MapLibre style recalculation which can cause other layers to
      // partially vanish. Layers are created only once; subsequent renders just swap the data.
      const existingSource = this.map.getSource?.(this.sourceId) as
        | { setData?: (data: unknown) => void }
        | undefined;

      if (existingSource && typeof existingSource.setData === 'function') {
        existingSource.setData(processedData);

        // Update paint properties in case color/opacity/stroke changed
        try {
          if (this.fillLayerId && this.map.getLayer?.(this.fillLayerId)) {
            this.map.setPaintProperty?.(this.fillLayerId, 'fill-color', this.color);
            this.map.setPaintProperty?.(this.fillLayerId, 'fill-opacity', this.opacity);
          }
          if (this.lineLayerId && this.map.getLayer?.(this.lineLayerId)) {
            this.map.setPaintProperty?.(this.lineLayerId, 'line-color', this.strokeColor);
            this.map.setPaintProperty?.(this.lineLayerId, 'line-width', this.strokeWidth);
          }
        } catch (paintErr) {
          debug.warn('[Isochrone] setPaintProperty failed', paintErr);
        }
      } else {
        // First render: create source + layers once
        // Find the layer to insert before (consumer `before-layer` or first circle layer)
        const beforeLayerId = this.findBeforeLayer();

        this.map.addSource(this.sourceId, {
          type: 'geojson',
          data: processedData,
        });

        // Add fill layer (above polygons, below points). Do not pass undefined as second arg (MapTiler coalesceChanges).
        if (this.fillLayerId) {
          const fillSpec = {
            id: this.fillLayerId,
            type: 'fill',
            source: this.sourceId,
            paint: {
              'fill-color': this.color,
              'fill-opacity': this.opacity,
              'fill-antialias': false,
            },
          };
          if (beforeLayerId != null) {
            this.map.addLayer(fillSpec, beforeLayerId);
          } else {
            this.map.addLayer(fillSpec);
          }
        }

        // Add line layer (above polygons, below points) - skip for H3 rendering to avoid stroke on hexagons
        if (this.lineLayerId && this.strokeWidth > 0 && this.render !== 'h3') {
          const lineSpec = {
            id: this.lineLayerId,
            type: 'line',
            source: this.sourceId,
            paint: {
              'line-color': this.strokeColor,
              'line-width': this.strokeWidth,
              'line-blur': 1, // Soften edges
            },
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
          };
          if (beforeLayerId != null) {
            this.map.addLayer(lineSpec, beforeLayerId);
          } else {
            this.map.addLayer(lineSpec);
          }
        }

        // Setup hover handlers on the fill layer
        this.setupHoverHandlers();

        // If consumer specified a before-layer, ensure ordering after addLayer
        // (addLayer already used beforeLayerId, but moveLayer handles edge cases
        //  where the reference layer was added after the initial addLayer call).
        const moveTarget = this.beforeLayer;
        if (moveTarget && this.map.moveLayer && this.map.getLayer?.(moveTarget)) {
          try {
            if (this.lineLayerId && this.map.getLayer?.(this.lineLayerId)) {
              this.map.moveLayer(this.lineLayerId, moveTarget);
            }
            if (this.fillLayerId && this.map.getLayer?.(this.fillLayerId)) {
              this.map.moveLayer(this.fillLayerId, moveTarget);
            }
          } catch (err) {
            debug.warn('[Isochrone] moveLayer failed', { moveTarget, err });
          }
        }
      }

      // Dispatch event immediately after we have the data
      // This allows demographics to start calculating concurrently with map rendering
      // Demographics only need the polygon geometry, not the visual rendering
      this.dispatchEvent(
        new CustomEvent('isochrone-loaded', {
          detail: { lat, lng, time, mode, data: result, element: this },
          bubbles: true,
        })
      );
    } catch (error) {
      const errorMsg = `[Isochrone] ✗ Failed to fetch isochrone for ${lat.toFixed(6)},${lng.toFixed(6)}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg, error);
      this.dispatchEvent(
        new CustomEvent('isochrone-error', {
          detail: {
            error,
            lat,
            lng,
            time,
            mode,
            element: this,
          },
          bubbles: true,
        })
      );
    }
  }

  /**
   * Clean up existing layers from map without clearing IDs
   * Used when re-rendering isochrone with new data
   */
  private cleanupExistingLayers(): void {
    if (this.map) {
      this.cleanupMapLayers(
        [this.lineLayerId, this.fillLayerId].filter(Boolean) as string[],
        [this.sourceId].filter(Boolean) as string[]
      );
    } else if (this.lineLayerId || this.fillLayerId || this.sourceId) {
      // Map is null but we still have layer IDs - try to clean up via parent map element
      const mapElement = this.mapElement;
      if (mapElement) {
        const mapInstance = (mapElement as any).getMap?.();
        if (mapInstance) {
          try {
            if (this.lineLayerId && mapInstance.getLayer?.(this.lineLayerId)) {
              mapInstance.removeLayer?.(this.lineLayerId);
            }
            if (this.fillLayerId && mapInstance.getLayer?.(this.fillLayerId)) {
              mapInstance.removeLayer?.(this.fillLayerId);
            }
            if (this.sourceId && mapInstance.getSource?.(this.sourceId)) {
              mapInstance.removeSource?.(this.sourceId);
            }
          } catch {
            // Silently ignore - map may be in invalid state
          }
        }
      }
    }
    // Note: Do NOT clear IDs here - they will be reused for new layers
  }

  /**
   * Full cleanup - remove layers AND clear all references
   * Used when element is being destroyed or map is unloaded
   */
  private removeIsochrone(): void {
    // Clean up layers
    this.cleanupExistingLayers();

    // Clear references (full cleanup)
    this.lineLayerId = null;
    this.fillLayerId = null;
    this.sourceId = null;
    this.currentCacheKey = null;
  }

  /**
   * Apply upgraded GeoJSON to the source and dispatch event in the next frame.
   * Deferring avoids mutating the map during requestIdleCallback (MapTiler coalesceChanges).
   */
  private applyUpgradedDataAndDispatch(
    source: unknown,
    upgradedData: GeoJSON.FeatureCollection,
    targetResolution: number
  ): void {
    const sourceWithSetData = source as { setData?: (data: unknown) => void };
    requestAnimationFrame(() => {
      if (source && typeof sourceWithSetData.setData === 'function') {
        sourceWithSetData.setData(upgradedData);
      }
      this.dispatchEvent(
        new CustomEvent('isochrone-upgraded', {
          detail: {
            lat: parseFloat(this.getAttribute('lat') || '0'),
            lng: parseFloat(this.getAttribute('lng') || '0'),
            resolution: targetResolution,
            element: this,
          },
          bubbles: true,
        })
      );
    });
  }

  /**
   * Convert raw polygon to H3 hexagons when user interacts with the map
   * Initial render uses raw polygon for instant visibility
   * This conversion happens on zoom/interaction for better visual quality
   */
  private async upgradeResolution(targetResolution: number): Promise<void> {
    if (!this.map || !this.sourceId || this.render !== 'h3' || this.hasUpgradedResolution) {
      return;
    }

    // Final visibility check before expensive conversion
    if (this.isElementVisible === false) {
      return; // Don't upgrade off-screen isochrones
    }

    // Mark as upgraded to prevent multiple conversions
    this.hasUpgradedResolution = true;

    try {
      // Get original API result (stored during fetch - this is the raw polygon)
      const originalData = (this as any)._originalIsochroneData;
      if (!originalData) {
        // If we don't have original data, try to get from source
        if (!this.sourceId || !this.map?.getSource) {
          this.hasUpgradedResolution = false;
          return;
        }
        const source = this.map.getSource(this.sourceId) as {
          _data?: GeoJSON.FeatureCollection;
          setData?: (data: unknown) => void;
        };
        if (!source || !source._data) {
          this.hasUpgradedResolution = false; // Reset so we can try again
          return;
        }

        // Try to convert from current source data (guard: source may have been removed by setStyle)
        const upgradedData = this.convertToH3(source._data);
        this.applyUpgradedDataAndDispatch(source, upgradedData, targetResolution);
        return;
      }

      // Convert original raw polygon to H3 hexagons at target resolution
      // This is the expensive operation, but we're doing it during idle time
      const upgradedData = this.convertToH3(originalData);

      // Validate conversion produced features
      if (!upgradedData || !upgradedData.features || upgradedData.features.length === 0) {
        debug.warn('[Isochrone] H3 conversion produced no features, keeping raw polygon');
        this.hasUpgradedResolution = false; // Reset so we can try again
        return;
      }

      // Defer setData to next frame so we don't run during requestIdleCallback (avoids MapTiler coalesceChanges)
      if (!this.sourceId || !this.map?.getSource) return;
      const source = this.map.getSource(this.sourceId) as unknown;
      this.applyUpgradedDataAndDispatch(source, upgradedData, targetResolution);
    } catch (error) {
      debug.warn(`[Isochrone] Failed to convert to H3 hexagons:`, error);
      // Reset on error so we can try again
      this.hasUpgradedResolution = false;
    }
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (this.isInitialized && oldValue !== newValue) {
      if (name === 'visible') {
        this.toggleVisibility();
      } else {
        // Clear cache key to force re-fetch when attributes change
        // This ensures the isochrone updates even if there's a timing issue
        if (name === 'time' || name === 'mode') {
          this.currentCacheKey = null;
        }
        this.waitForStyleLoaded(() => this.fetchAndRenderIsochrone());
      }
    }
  }

  private toggleVisibility(): void {
    if (!this.map) return;

    // Guard against map with no style (WebGL context lost or map being destroyed)
    try {
      const style = (this.map as { getStyle?: () => unknown })?.getStyle?.();
      if (!style) return;
    } catch {
      // Map may be in invalid state during destruction
      return;
    }

    const visibility = this.visible ? 'visible' : 'none';

    try {
      if (this.fillLayerId && this.map?.getLayer?.(this.fillLayerId)) {
        this.map?.setLayoutProperty?.(this.fillLayerId, 'visibility', visibility);
      }

      if (this.lineLayerId && this.map?.getLayer?.(this.lineLayerId)) {
        this.map?.setLayoutProperty?.(this.lineLayerId, 'visibility', visibility);
      }
    } catch {
      // Silently ignore - map may be in invalid state during context loss
    }
  }

  protected override onMapUnload(): void {
    // Clean up hover handlers before map reference is cleared
    this.cleanupHoverHandlers();
    // Clean up layers when map is frozen/unloaded
    // This ensures proper cleanup even if element stays in DOM
    this.removeIsochrone();
    super.onMapUnload();
  }

  override disconnectedCallback(): void {
    // Clean up hover handlers
    this.cleanupHoverHandlers();

    // Clean up map interaction listeners
    this.cleanupMapInteractionListeners();

    // Clean up intersection observer
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }

    this.removeIsochrone();
    super.disconnectedCallback();
  }

  // Getters
  get time(): number {
    return parseInt(this.getAttribute('time') || '15') || 15;
  }

  get mode(): 'driving' | 'walking' | 'cycling' {
    const mode = this.getAttribute('mode');
    if (mode === 'walking' || mode === 'cycling') return mode;
    return 'driving';
  }

  get color(): string {
    return (
      this.getAttribute('color') || getCSSVariable(this.mapElement, '--gk-isochrone-color', '')
    );
  }

  get opacity(): number {
    const attr = this.getAttribute('opacity');
    if (attr !== null && attr !== '') {
      const parsed = parseFloat(attr);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return getCSSVariableNumber(this.mapElement, '--gk-isochrone-opacity', 0.3);
  }

  get strokeColor(): string {
    return (
      this.getAttribute('stroke-color') ||
      getCSSVariable(this.mapElement, '--gk-isochrone-stroke-color', '')
    );
  }

  get strokeWidth(): number {
    const attr = this.getAttribute('stroke-width');
    if (attr === null) return 0; // Default to no stroke
    const parsed = parseFloat(attr);
    return isNaN(parsed) ? 0 : parsed;
  }

  get visible(): boolean {
    return this.getAttribute('visible') !== 'false';
  }

  /** Layer ID to insert isochrone layers before (consumer controls ordering). */
  get beforeLayer(): string | null {
    return this.getAttribute('before-layer');
  }

  get render(): 'polygon' | 'h3' {
    const render = this.getAttribute('render');
    return render === 'h3' ? 'h3' : 'polygon';
  }

  get h3Resolution(): number {
    const resolution = parseInt(this.getAttribute('h3-resolution') || '7');
    // Clamp to valid H3 resolution range (0-15)
    return Math.max(0, Math.min(15, resolution));
  }

  /**
   * Get pre-computed isochrone data from the 'data' attribute or setData() call
   * Returns null if not set or invalid JSON
   */
  get storedData(): GeoJSON.FeatureCollection | null {
    // Check for data set via setData() first (avoids JSON parsing overhead)
    const internalData = (this as any)._storedData;
    if (internalData) return internalData;

    // Fall back to data attribute
    const dataAttr = this.getAttribute('data');
    if (!dataAttr) return null;

    try {
      const parsed = JSON.parse(dataAttr);
      // Validate it looks like a FeatureCollection
      if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        return parsed as GeoJSON.FeatureCollection;
      }
      return null;
    } catch {
      debug.warn('[Isochrone] Invalid JSON in data attribute');
      return null;
    }
  }

  /**
   * Set pre-computed isochrone data programmatically
   * This avoids stringifying large JSON in attributes.
   * The data is tagged with the current time/mode so it's only used when settings match.
   */
  setData(data: GeoJSON.FeatureCollection | null): void {
    if (data) {
      // Store internally along with the time/mode it was set for
      // This allows us to reuse it later if the user switches back to these settings
      (this as any)._storedData = data;
      (this as any)._storedDataTime = this.time;
      (this as any)._storedDataMode = this.mode;
      this.currentCacheKey = null; // Force re-render
      this.waitForStyleLoaded(() => this.fetchAndRenderIsochrone());
    } else {
      delete (this as any)._storedData;
      delete (this as any)._storedDataTime;
      delete (this as any)._storedDataMode;
    }
  }

  /**
   * Convert isochrone polygons to H3 hexagons and merge them
   */
  private convertToH3(featureCollection: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
    const resolution = this.h3Resolution;
    const processedFeatures: GeoJSON.Feature[] = [];

    for (const feature of featureCollection.features) {
      // Only process Polygon geometries (skip MultiPolygon from API)
      if (feature.geometry.type !== 'Polygon') {
        // If it's already a MultiPolygon, keep it as is
        processedFeatures.push(feature);
        continue;
      }

      const polygon = feature.geometry as Polygon;
      const color = feature.properties?.fill || feature.properties?.color || this.color;
      const contour = feature.properties?.contour;

      try {
        // Convert polygon to H3 cells
        const hexagons = polygonToH3(polygon, resolution);

        if (hexagons.length === 0) {
          // If no hexagons found, keep original polygon
          processedFeatures.push(feature);
          continue;
        }

        // Sort H3 cells to ensure deterministic MultiPolygon generation
        // This prevents the geometry from changing between page loads
        const sortedHexagons = [...hexagons].sort();

        // Merge all H3 cells into a continuous MultiPolygon
        const mergedGeometry = h3SetToMultiPolygon(sortedHexagons);

        // Validate merged geometry
        if (
          !mergedGeometry ||
          !mergedGeometry.coordinates ||
          mergedGeometry.coordinates.length === 0
        ) {
          processedFeatures.push(feature);
          continue;
        }

        // Create new feature with merged geometry
        processedFeatures.push({
          type: 'Feature',
          geometry: mergedGeometry as GeoJSON.MultiPolygon,
          properties: {
            ...feature.properties,
            contour,
            color,
            fill: color,
            'fill-opacity': this.opacity,
          },
        });
      } catch {
        // Fallback to original polygon on error
        processedFeatures.push(feature);
      }
    }

    return {
      type: 'FeatureCollection',
      features: processedFeatures,
    };
  }

  // Public API
  async refresh(): Promise<void> {
    this.currentCacheKey = null; // Force refresh
    await this.waitForStyleLoaded(() => this.fetchAndRenderIsochrone());
  }

  show(): void {
    this.setAttribute('visible', 'true');
  }

  hide(): void {
    this.setAttribute('visible', 'false');
  }
}

// Register the custom element
if (!customElements.get('gk-isochrone')) {
  customElements.define('gk-isochrone', IsochroneElement);
}
