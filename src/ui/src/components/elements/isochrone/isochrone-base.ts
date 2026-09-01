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

import { MapChildElement } from '../../map-child-element';
import { getServiceForCapability } from '@geokit/service/registry';
import { smoothFeatureCollection } from '@geokit/core';
import { debug } from '../../../utils/logger';
import { getCSSVariable, getCSSVariableNumber } from '../../../utils/theme';
import {
  buildChoroplethFillPaint,
  type FillAntialiasMap,
} from '../../../utils/choropleth-fill-paint';

import { isochroneEl } from './isochrone-el';
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

export class IsochroneBase extends MapChildElement {
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

  protected sourceId: string | null = null;
  protected lineLayerId: string | null = null;
  protected fillLayerId: string | null = null;
  protected currentCacheKey: string | null = null;
  protected intersectionObserver: IntersectionObserver | null = null;
  protected isElementVisible: boolean | null = true; // Default to true for immediate rendering
  protected hasUpgradedResolution: boolean = false; // Track if resolution has been upgraded
  protected mapInteractionListeners: Array<() => void> = []; // Store cleanup functions for map event listeners
  protected upgradeDebounceTimer: number | null = null; // Debounce timer for resolution upgrades
  protected pendingUpgrade: boolean = false; // Track if an upgrade is pending
  protected readonly UPGRADE_DEBOUNCE_MS = 500; // Wait 500ms after interaction stops before upgrading
  protected readonly MIN_ZOOM_FOR_UPGRADE = 8; // Convert to hexagons at zoom 8+

  constructor() {
    super();
    isochroneEl(this).attachShadow({ mode: 'open' });
  }

  protected override async onMapReady(): Promise<void> {
    // By the time onMapReady is called, the parent gk-map is fully initialized
    // No need to wait for style - it's already loaded
    if (!isochroneEl(this).map) {
      console.warn('[gk-isochrone] onMapReady called but no map instance');
      return;
    }

    // Setup visibility observer to only fetch when element is visible
    isochroneEl(this).setupVisibilityObserver();

    // Fetch immediately - map is ready, no need to wait
    isochroneEl(this).fetchAndRenderIsochrone();

    // H3 render mode only: upgrade raw polygon to hex cells on zoom/interaction
    if (isochroneEl(this).render === 'h3') {
      isochroneEl(this).setupMapInteractionListeners();
    }
  }

  /** Re-add isochrone layers after map style change (e.g. theme toggle). */
  protected override onStyleLoad(): void {
    if (!isochroneEl(this).map) return;
    // Clear cache so we re-add layers even though data is unchanged (style replace removed them)
    isochroneEl(this).currentCacheKey = null;
    // We're only called after gk-map-style-load (style already replaced). Use double rAF to avoid
    // MapTiler coalesceChanges; don't use waitForStyleLoaded (style.load may have already fired).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isochroneEl(this).fetchAndRenderIsochrone();
      });
    });
  }

  // Cleanup function for hover handlers (stored so we can remove on teardown)
  protected hoverCleanup: (() => void) | null = null;

  /**
   * Setup hover handlers on the fill layer so consumers receive
   * `gk-isochrone-hover` / `gk-isochrone-hover-end` events.
   */
  protected setupHoverHandlers(): void {
    if (!isochroneEl(this).map || !isochroneEl(this).fillLayerId) return;
    if (!isochroneEl(this).map.getLayer?.(isochroneEl(this).fillLayerId)) return;

    // Clean up previous handlers (idempotent)
    isochroneEl(this).cleanupHoverHandlers();

    const fillLayer = isochroneEl(this).fillLayerId;

    const onMouseEnter = (e: any): void => {
      const canvas = isochroneEl(this).map?.getCanvas?.();
      if (canvas?.style) canvas.style.cursor = 'pointer';

      isochroneEl(this).dispatchEvent(
        new CustomEvent('gk-isochrone-hover', {
          detail: {
            lngLat: e.lngLat,
            features: e.features,
            map: isochroneEl(this).map,
            element: this,
          },
          bubbles: true,
          cancelable: true,
        })
      );
    };

    const onMouseLeave = (): void => {
      const canvas = isochroneEl(this).map?.getCanvas?.();
      if (canvas?.style) canvas.style.cursor = '';

      isochroneEl(this).dispatchEvent(
        new CustomEvent('gk-isochrone-hover-end', {
          detail: {
            map: isochroneEl(this).map,
            element: this,
          },
          bubbles: true,
          cancelable: true,
        })
      );
    };

    isochroneEl(this).map.on('mouseenter', fillLayer, onMouseEnter);
    isochroneEl(this).map.on('mouseleave', fillLayer, onMouseLeave);

    isochroneEl(this).hoverCleanup = () => {
      try {
        isochroneEl(this).map?.off?.('mouseenter', fillLayer, onMouseEnter);
        isochroneEl(this).map?.off?.('mouseleave', fillLayer, onMouseLeave);
      } catch {
        // Map may already be destroyed
      }
    };
  }

  protected cleanupHoverHandlers(): void {
    if (isochroneEl(this).hoverCleanup) {
      isochroneEl(this).hoverCleanup();
      isochroneEl(this).hoverCleanup = null;
    }
  }

  /**
   * Setup listeners for map interactions (zoom, pan, etc.) to upgrade resolution
   * Uses debouncing and zoom-level checks to optimize performance
   */
  protected setupMapInteractionListeners(): void {
    if (!isochroneEl(this).map) return;

    // Clean up any existing listeners
    isochroneEl(this).cleanupMapInteractionListeners();

    const scheduleUpgrade = () => {
      // Skip if already upgraded or not H3 mode
      if (isochroneEl(this).hasUpgradedResolution || isochroneEl(this).render !== 'h3') {
        return;
      }

      // Check zoom level - only convert to hexagons if zoomed in enough
      const currentZoom = (isochroneEl(this).map as { getZoom?: () => number })?.getZoom?.() || 0;
      if (currentZoom < isochroneEl(this).MIN_ZOOM_FOR_UPGRADE) {
        return; // Too zoomed out, keep raw polygon
      }

      // Check if element is visible
      if (isochroneEl(this).isElementVisible === false) {
        return; // Don't upgrade off-screen isochrones
      }

      // Clear existing debounce timer
      if (isochroneEl(this).upgradeDebounceTimer !== null) {
        clearTimeout(isochroneEl(this).upgradeDebounceTimer);
        isochroneEl(this).upgradeDebounceTimer = null;
      }

      // Mark that we have a pending upgrade
      isochroneEl(this).pendingUpgrade = true;

      // Debounce: wait for interaction to settle before converting to hexagons
      isochroneEl(this).upgradeDebounceTimer = window.setTimeout(() => {
        isochroneEl(this).upgradeDebounceTimer = null;

        // Double-check conditions before upgrading
        if (isochroneEl(this).hasUpgradedResolution || isochroneEl(this).render !== 'h3' || !isochroneEl(this).map) {
          isochroneEl(this).pendingUpgrade = false;
          return;
        }

        const targetResolution = isochroneEl(this).h3Resolution;
        // Convert from raw polygon to H3 hexagons
        requestIdleCallback(
          () => {
            isochroneEl(this).pendingUpgrade = false;
            isochroneEl(this).upgradeResolution(targetResolution);
          },
          { timeout: 2000 } // Start upgrade after 2 seconds max if no idle time
        );
      }, isochroneEl(this).UPGRADE_DEBOUNCE_MS);
    };

    // Upgrade on zoom (use 'zoomend' to avoid firing on every zoom step)
    const zoomListener = () => scheduleUpgrade();
    if (isochroneEl(this).map.on) {
      isochroneEl(this).map.on('zoomend', zoomListener);
      isochroneEl(this).mapInteractionListeners.push(() => {
        if (isochroneEl(this).map?.off) isochroneEl(this).map.off('zoomend', zoomListener);
      });
    }

    // Upgrade on move/pan (use 'moveend' to avoid firing on every move step)
    const moveListener = () => scheduleUpgrade();
    if (isochroneEl(this).map.on) {
      isochroneEl(this).map.on('moveend', moveListener);
      isochroneEl(this).mapInteractionListeners.push(() => {
        if (isochroneEl(this).map?.off) isochroneEl(this).map.off('moveend', moveListener);
      });
    }

    // Upgrade on click/interaction (immediate, no debounce for clicks)
    const clickListener = () => {
      if (isochroneEl(this).hasUpgradedResolution || isochroneEl(this).render !== 'h3') {
        return;
      }

      const currentZoom = (isochroneEl(this).map as { getZoom?: () => number })?.getZoom?.() || 0;
      if (currentZoom < isochroneEl(this).MIN_ZOOM_FOR_UPGRADE) {
        return;
      }

      // Clear debounce timer since user explicitly clicked
      if (isochroneEl(this).upgradeDebounceTimer !== null) {
        clearTimeout(isochroneEl(this).upgradeDebounceTimer);
        isochroneEl(this).upgradeDebounceTimer = null;
      }

      const targetResolution = isochroneEl(this).h3Resolution;
      // Convert from raw polygon to H3 hexagons on click
      requestIdleCallback(
        () => {
          isochroneEl(this).upgradeResolution(targetResolution);
        },
        { timeout: 1000 } // Faster timeout for explicit clicks
      );
    };
    if (isochroneEl(this).map.on) {
      isochroneEl(this).map.on('click', clickListener);
      isochroneEl(this).mapInteractionListeners.push(() => {
        if (isochroneEl(this).map?.off) isochroneEl(this).map.off('click', clickListener);
      });
    }
  }

  /**
   * Clean up map interaction listeners
   */
  protected cleanupMapInteractionListeners(): void {
    isochroneEl(this).mapInteractionListeners.forEach((cleanup: () => void) => cleanup());
    isochroneEl(this).mapInteractionListeners = [];

    // Clear debounce timer
    if (isochroneEl(this).upgradeDebounceTimer !== null) {
      clearTimeout(isochroneEl(this).upgradeDebounceTimer);
      isochroneEl(this).upgradeDebounceTimer = null;
    }

    isochroneEl(this).pendingUpgrade = false;
  }

  /**
   * Setup IntersectionObserver to track element visibility
   * Only fetches isochrone data when element is actually visible
   */
  protected setupVisibilityObserver(): void {
    // Check if element is in a visible map card
    const mapCard = isochroneEl(this).closest('.map-card');
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
      isochroneEl(this).isElementVisible = isCardHidden ? false : null;

      // Use IntersectionObserver to watch for visibility changes
      isochroneEl(this).intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const wasVisible = isochroneEl(this).isElementVisible;
            isochroneEl(this).isElementVisible = entry.isIntersecting;

            // If element just became visible and we haven't fetched yet, fetch now
            // Store map reference locally to avoid race conditions
            const map = isochroneEl(this).map;
            if (isochroneEl(this).isElementVisible && !wasVisible && map && isochroneEl(this).sourceId) {
              // Check if we already have a source (already fetched)
              // Double-check map is still valid and has getSource method
              if (map && typeof map.getSource === 'function') {
                try {
                  const hasSource = map.getSource(isochroneEl(this).sourceId);
                  if (!hasSource) {
                    isochroneEl(this).waitForStyleLoaded(() => {
                      isochroneEl(this).fetchAndRenderIsochrone();
                    });
                  }
                } catch (error) {
                  // Map might be in invalid state, try to fetch anyway
                  debug.warn('[gk-isochrone] Error checking source, attempting fetch:', error);
                  isochroneEl(this).waitForStyleLoaded(() => {
                    isochroneEl(this).fetchAndRenderIsochrone();
                  });
                }
              } else {
                // Map exists but getSource not available yet, try to fetch anyway
                isochroneEl(this).waitForStyleLoaded(() => {
                  isochroneEl(this).fetchAndRenderIsochrone();
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
      isochroneEl(this).intersectionObserver.observe(mapCard);
    } else {
      // No map card parent, assume visible (null = try to load)
      isochroneEl(this).isElementVisible = null;
    }
  }

  override async connectedCallback() {
    await super.connectedCallback();

    if (isochroneEl(this).isInitialized) return;

    // If a stable source-id attribute is set, use it instead of a random UUID.
    // This allows the host app to pre-create the source + layers (with empty data)
    // during map setup, so the isochrone only ever calls setData() — never
    // addSource/addLayer — which avoids MapTiler style recalculation that can
    // make other circle layers partially vanish.
    const stableId = isochroneEl(this).getAttribute('source-id');
    if (stableId) {
      isochroneEl(this).sourceId = stableId;
      isochroneEl(this).fillLayerId = `polygon-fill-${stableId}`;
      isochroneEl(this).lineLayerId = `polygon-stroke-${stableId}`;
    } else {
      const uuid = crypto.randomUUID();
      isochroneEl(this).sourceId = `isochrone-${uuid}`;
      isochroneEl(this).fillLayerId = `polygon-fill-isochrone-${uuid}`;
      isochroneEl(this).lineLayerId = `polygon-stroke-isochrone-${uuid}`;
    }

    isochroneEl(this).isInitialized = true;
  }

  /**
   * Determine which layer to insert isochrone layers before.
   * 1) Consumer-provided `before-layer` attribute (explicit ordering).
   * 2) First circle layer in the style (generic fallback).
   */
  protected findBeforeLayer(): string | undefined {
    // Prefer explicit before-layer attribute set by the consumer
    const explicit = isochroneEl(this).beforeLayer;
    if (explicit && isochroneEl(this).map?.getLayer?.(explicit)) return explicit;

    if (!isochroneEl(this).map) return undefined;
    try {
      const style = (
        isochroneEl(this).map as { getStyle?: () => { layers?: Array<{ id?: string; type?: string }> } }
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

}
