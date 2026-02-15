/**
 * Map Utilities
 *
 * Standalone utilities for working with raw MapInstance.
 * Use these when you only have a MapLibre map instance, not a MapElement reference.
 *
 * When you have a MapElement, prefer its instance methods instead:
 * - mapElement.updateSourceData(sourceId, data)
 * - mapElement.getSourceData(sourceId)
 * - mapElement.findFeatureById(sourceId, featureId, idProperties)
 * - mapElement.getFullFeatureProperties(sourceId, partialProperties, idProperties)
 * - mapElement.setLayerVisibility(layerId, visible)
 * - mapElement.setLayersVisibility(layerIds, visible)
 * - mapElement.setLayerFilter(layerId, filterExpression)
 * - mapElement.updateFeatureSelection(sourceId, selectedId, selectionProperty, idProperties)
 */

import type { MapInstance } from '../providers/types';
import type { Feature } from '../../types';
import type { IsochroneOptions } from '../../api/providers/types';
import { getProviderForCapability } from '../../api/providers/registry';

// ============================================================================
// DOM Navigation Utilities
// ============================================================================

/**
 * Get map instance from a gk-map element
 * @param element The gk-map element
 * @returns The map instance or null if not available
 */
export function getMapInstance(element: HTMLElement | null): MapInstance | null {
  if (!element) return null;
  return (element as any).getMap?.() || null;
}

/**
 * Find gk-map element in DOM tree starting from given element
 * Traverses up the DOM tree to find the nearest parent gk-map element.
 *
 * @param element Starting element to search from
 * @returns The gk-map element or null if not found
 */
export function findMapElement(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;

  let current: HTMLElement | null = element;
  while (current) {
    if (current.tagName?.toLowerCase() === 'gk-map') {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

/**
 * Find gk-map element from a MapInstance
 * Uses the map container to locate the parent gk-map element.
 *
 * @param map MapInstance to find element for
 * @returns The gk-map element or null if not found
 */
export function findMapElementFromInstance(map: MapInstance | null): HTMLElement | null {
  if (!map) return null;

  const container = (map as any).getContainer?.();
  if (!container) return null;

  return findMapElement(container);
}

/**
 * Get map instance from element or find parent map element first
 * Convenience function that combines findMapElement() and getMapInstance()
 *
 * @param element Element to start from (can be any element, not just gk-map)
 * @returns The map instance or null if not available
 */
export function getMapInstanceFromElement(element: HTMLElement | null): MapInstance | null {
  const mapElement = findMapElement(element);
  return getMapInstance(mapElement);
}

// ============================================================================
// Container-scoped map event helpers
// ============================================================================

/** gk-map-ready detail shape (element = gk-map, map = MapLibre instance) */
export interface GkMapReadyDetail {
  map?: MapInstance;
  element?: HTMLElement;
}

/**
 * Run a handler when gk-map-ready fires and the event target is inside the given container.
 * Use when you have multiple maps (e.g. in a collection) and only want to react to maps in your subtree.
 *
 * @param container - Parent element (e.g. grid or hero node)
 * @param handler - Called with (mapElement, mapInstance) when a map in container becomes ready
 * @returns Unsubscribe function
 */
export function onMapReadyInContainer(
  container: HTMLElement | null,
  handler: (mapElement: HTMLElement, mapInstance: MapInstance | null) => void | Promise<void>
): () => void {
  if (!container) return () => {};

  const listener = async (event: Event): Promise<void> => {
    const customEvent = event as CustomEvent<GkMapReadyDetail>;
    const mapElement = (customEvent.detail?.element ?? event.target) as HTMLElement;
    if (!mapElement || !container.contains(mapElement)) return;

    const mapInstance =
      (mapElement as HTMLElement & { getMap?: () => MapInstance })?.getMap?.() ??
      customEvent.detail?.map ??
      null;
    await handler(mapElement, mapInstance);
  };

  document.addEventListener('gk-map-ready', listener as EventListener);
  return () => document.removeEventListener('gk-map-ready', listener as EventListener);
}

/**
 * Run a handler when a map is unloaded and the event target is inside the given container.
 *
 * @param container - Parent element
 * @param handler - Called with (mapElement, mapInstance) when a map in container unloads
 * @returns Unsubscribe function
 */
export function onMapUnloadInContainer(
  container: HTMLElement | null,
  handler: (mapElement: HTMLElement, mapInstance: MapInstance | null) => void
): () => void {
  if (!container) return () => {};

  const listener = (event: Event): void => {
    const customEvent = event as CustomEvent<GkMapReadyDetail>;
    const mapElement = (customEvent.detail?.element ?? event.target) as HTMLElement;
    if (!mapElement || !container.contains(mapElement)) return;

    const mapInstance =
      (mapElement as HTMLElement & { getMap?: () => MapInstance })?.getMap?.() ??
      customEvent.detail?.map ??
      null;
    handler(mapElement, mapInstance);
  };

  document.addEventListener('gk-map-unload', listener);
  return () => document.removeEventListener('gk-map-unload', listener);
}

/**
 * Run a handler when gk-map-unfreeze fires and the event target is inside the given container.
 *
 * @param container - Parent element
 * @param handler - Called with (mapElement, mapInstance) when a map in container unfreezes
 * @returns Unsubscribe function
 */
export function onMapUnfreezeInContainer(
  container: HTMLElement | null,
  handler: (mapElement: HTMLElement, mapInstance: MapInstance | null) => void | Promise<void>
): () => void {
  if (!container) return () => {};

  const listener = async (event: Event): Promise<void> => {
    const customEvent = event as CustomEvent<GkMapReadyDetail>;
    const mapElement = (customEvent.detail?.element ?? event.target) as HTMLElement;
    if (!mapElement || !container.contains(mapElement)) return;

    const mapInstance =
      (mapElement as HTMLElement & { getMap?: () => MapInstance })?.getMap?.() ??
      customEvent.detail?.map ??
      null;
    await handler(mapElement, mapInstance);
  };

  document.addEventListener('gk-map-unfreeze', listener as EventListener);
  return () => document.removeEventListener('gk-map-unfreeze', listener as EventListener);
}

// ============================================================================
// Style Loading Utilities
// ============================================================================

/**
 * Wait for map style to be loaded before executing code.
 * This is important because map.addLayer() silently fails if style isn't loaded.
 *
 * @param map - MapInstance (MapLibre map)
 * @param timeoutMs - Optional timeout in milliseconds (default: 10000)
 * @returns Promise that resolves when style is loaded
 * @throws Error if timeout is reached or map is invalid
 */
export function waitForMapStyleLoaded(
  map: MapInstance | null,
  timeoutMs: number = 10000
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!map) {
      reject(new Error('[geokit] Map instance is required'));
      return;
    }

    // Check if style is already loaded
    const isStyleLoaded = typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : false;
    const hasStyle = typeof map.getStyle === 'function' && map.getStyle() != null;
    if (isStyleLoaded || hasStyle) {
      resolve();
      return;
    }

    // Style not loaded yet - wait for it
    let resolved = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (map.off) {
        map.off('load', loadHandler);
        map.off('style.load', styleLoadHandler);
      }
    };

    const handleResolve = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve();
    };

    const loadHandler = () => {
      const loaded = typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : true;
      if (loaded) handleResolve();
    };

    const styleLoadHandler = () => {
      const loaded = typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : true;
      if (loaded) handleResolve();
    };

    // Set up timeout
    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error(`[geokit] Timeout waiting for map style to load (${timeoutMs}ms)`));
      }
    }, timeoutMs);

    // Register event listeners
    if (map.on) {
      map.on('load', loadHandler);
      map.on('style.load', styleLoadHandler);
    } else {
      handleResolve();
    }
  });
}

/**
 * Check if map style is loaded
 * @param map - MapInstance
 * @returns true if style is loaded, false otherwise
 */
export function isMapStyleLoaded(map: MapInstance | null): boolean {
  if (!map) return false;
  return typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : false;
}

// ============================================================================
// Map State Utilities
// ============================================================================

/**
 * Check if a map instance is in a usable state.
 *
 * More defensive than `isMapStyleLoaded` — catches exceptions thrown by
 * destroyed/frozen map instances (e.g. after a component unmounts or a
 * map-collection pool recycles the element) and verifies `getStyle()`
 * returns a valid style object with sources.
 *
 * Use this as a guard before any map SDK call that could throw on a
 * stale reference.
 *
 * @param map - MapInstance (or null/undefined)
 * @returns true when the map can safely accept addLayer/setData/etc. calls
 *
 * @example
 * ```ts
 * if (!isMapUsable(map)) return;
 * map.addLayer(layerSpec);
 * ```
 */
export function isMapUsable(map: MapInstance | null | undefined): boolean {
  if (!map) return false;
  try {
    const style = map.getStyle?.();
    if (!style) return false;
    if (typeof style === 'object' && !(style as Record<string, unknown>).sources) return false;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Source Data Utilities
// ============================================================================

/**
 * Safely update GeoJSON source data on a raw MapInstance.
 *
 * This is the standalone equivalent of `MapElement.updateSourceData()`.
 * Use it when you only have a MapInstance reference (not a gk-map element).
 *
 * Guards against:
 * - Missing source (returns false)
 * - Source without `setData` method (returns false)
 * - Exceptions from destroyed maps (returns false)
 *
 * @param map      - MapInstance to update
 * @param sourceId - GeoJSON source ID
 * @param data     - New GeoJSON data to set
 * @returns true if the update succeeded, false otherwise
 *
 * @example
 * ```ts
 * const ok = updateSourceData(map, 'venues', featureCollection);
 * if (!ok) console.warn('Source update failed');
 * ```
 */
export function updateSourceData(
  map: MapInstance | null | undefined,
  sourceId: string,
  data: unknown
): boolean {
  if (!map) return false;
  try {
    const source = map.getSource?.(sourceId);
    if (!source) return false;
    if (typeof (source as any).setData !== 'function') return false;
    (source as any).setData(data);
    return true;
  } catch (error) {
    console.warn(`[geokit] Failed to update source: ${sourceId}`, error);
    return false;
  }
}

// ============================================================================
// Cursor Management Utilities
// ============================================================================

/**
 * Set up cursor pointer handling for map layers
 *
 * @param map - Map instance
 * @param layerIds - Single layer ID or array of layer IDs to attach cursor handlers to
 * @param cursor - Cursor style (default: 'pointer')
 * @returns Cleanup function to remove event listeners, or null if setup failed
 *
 * @example
 * ```ts
 * const cleanup = setupLayerCursor(map, 'venue-layer');
 * // Later: cleanup?.();
 * ```
 */
export function setupLayerCursor(
  map: MapInstance | null | undefined,
  layerIds: string | string[],
  cursor: string = 'pointer'
): (() => void) | null {
  if (!map) return null;

  const layers = Array.isArray(layerIds) ? layerIds : [layerIds];
  const cleanupFunctions: Array<() => void> = [];

  const mouseEnterHandler = () => {
    const canvas = map.getCanvas?.();
    if (canvas) canvas.style.cursor = cursor;
  };

  const mouseLeaveHandler = () => {
    const canvas = map.getCanvas?.();
    if (canvas) canvas.style.cursor = '';
  };

  for (const layerId of layers) {
    if (!layerId) continue;

    map.on('mouseenter', layerId, mouseEnterHandler);
    map.on('mouseleave', layerId, mouseLeaveHandler);

    cleanupFunctions.push(() => {
      map.off('mouseenter', layerId, mouseEnterHandler);
      map.off('mouseleave', layerId, mouseLeaveHandler);
    });
  }

  return () => cleanupFunctions.forEach((cleanup) => cleanup());
}

// ============================================================================
// Isochrone Prefetch Utilities
// ============================================================================

export interface IsochronePrefetchOptions {
  /** Travel time in minutes */
  time: number;
  /** Travel mode */
  mode: 'driving' | 'walking' | 'cycling';
  /** Debounce delay in ms (default: 200) */
  debounceMs?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Set up isochrone prefetching on layer hover
 * Prefetches isochrone data when hovering over point features to improve click response time.
 * Automatically checks cache to avoid redundant API calls.
 *
 * @param map - Map instance
 * @param layerId - Layer ID to attach hover handlers to
 * @param options - Prefetch options (time, mode, debounce)
 * @returns Cleanup function to remove event listeners, or null if setup failed
 *
 * @example
 * ```ts
 * const cleanup = setupIsochronePrefetch(map, 'venue-layer', {
 *   time: 15,
 *   mode: 'driving',
 * });
 * ```
 */
export function setupIsochronePrefetch(
  map: MapInstance | null | undefined,
  layerId: string,
  options: IsochronePrefetchOptions
): (() => void) | null {
  if (!map || !layerId) return null;

  const { time, mode, debounceMs = 200, debug: enableDebug = false } = options;
  let prefetchTimeout: ReturnType<typeof setTimeout> | null = null;

  const log = enableDebug
    ? (...args: unknown[]) => console.log('[geokit:prefetch]', ...args)
    : () => {};

  const prefetchHandler = (e: any) => {
    const features = e.features;
    if (!features || features.length === 0) return;

    const feature = features[0];
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) return;

    const [lng, lat] = coords as [number, number];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    if (prefetchTimeout) {
      clearTimeout(prefetchTimeout);
      prefetchTimeout = null;
    }

    prefetchTimeout = setTimeout(async () => {
      const provider = getProviderForCapability('isochrone');
      if (!provider?.fetchIsochrone) {
        log('No isochrone provider available');
        return;
      }

      const isoOptions: IsochroneOptions = { lat, lng, minutes: [time], mode };

      if (provider.hasIsochroneCached?.(isoOptions)) {
        log('Already cached:', lat.toFixed(4), lng.toFixed(4));
        return;
      }

      log('Prefetching:', lat.toFixed(4), lng.toFixed(4));

      try {
        await provider.fetchIsochrone(isoOptions);
        log('Prefetch complete:', lat.toFixed(4), lng.toFixed(4));
      } catch (error) {
        log('Prefetch failed:', error);
      }
    }, debounceMs);
  };

  const cancelHandler = () => {
    if (prefetchTimeout) {
      clearTimeout(prefetchTimeout);
      prefetchTimeout = null;
    }
  };

  map.on('mouseenter', layerId, prefetchHandler);
  map.on('mouseleave', layerId, cancelHandler);

  return () => {
    if (prefetchTimeout) {
      clearTimeout(prefetchTimeout);
      prefetchTimeout = null;
    }
    map.off('mouseenter', layerId, prefetchHandler);
    map.off('mouseleave', layerId, cancelHandler);
  };
}

// ============================================================================
// Layer Click Popup Utilities
// ============================================================================

import { PopupElement, type PopupContentOptions } from '../components/elements/popup/popup';

export interface LayerClickPopupOptions {
  /** Source ID to get full feature properties from */
  sourceId: string;
  /** Property names to check for feature ID (default: ['id', 'slug']) */
  idProperties?: string[];
  /** Build popup content from feature properties */
  buildContent: (
    properties: Record<string, unknown>,
    feature: Feature
  ) => PopupContentOptions | null;
  /** Called when a feature is clicked, before popup is shown */
  onFeatureClick?: (feature: Feature, coordinates: { lng: number; lat: number }) => void;
  /** Called after popup is opened */
  onPopupOpen?: (popup: unknown) => void;
  /** Called when popup is closed */
  onPopupClose?: () => void;
  /** Show close button on popup (default: true) */
  closeButton?: boolean;
}

/**
 * Set up click-to-popup behavior for a map layer
 * Handles the common pattern of clicking a feature to show a popup.
 *
 * This utility handles boilerplate:
 * - Feature extraction from click event
 * - Full properties lookup from source (via MapElement)
 * - Closing existing popups
 * - Building and showing popup via user-provided function
 *
 * For app-specific behavior (selection state, cross-map coordination),
 * use the callbacks or wrap this utility.
 *
 * @param map - Map instance
 * @param layerId - Layer ID to attach click handler to
 * @param options - Configuration options
 * @returns Cleanup function to remove event listener, or null if setup failed
 *
 * @example
 * ```ts
 * const cleanup = setupLayerClickPopup(map, 'venue-layer', {
 *   sourceId: 'venues',
 *   buildContent: (props) => ({
 *     headline: props.name as string,
 *     subhead: `${props.city}, ${props.state}`,
 *     tags: [props.market as string],
 *   }),
 *   onFeatureClick: (feature, coords) => {
 *     // Update selection state, emit events, etc.
 *   },
 * });
 * ```
 */
export function setupLayerClickPopup(
  map: MapInstance | null | undefined,
  layerId: string,
  options: LayerClickPopupOptions
): (() => void) | null {
  if (!map || !layerId) return null;

  const {
    sourceId,
    idProperties = ['id', 'slug'],
    buildContent,
    onFeatureClick,
    onPopupOpen,
    onPopupClose,
    closeButton = true,
  } = options;

  let currentPopup: unknown = null;

  // Find the MapElement to use its methods for source lookups
  const mapElement = findMapElementFromInstance(map);

  const clickHandler = (e: any) => {
    const features = e.features;
    if (!features || features.length === 0) return;

    const feature = features[0] as Feature;
    const partialProps = (feature.properties || {}) as Record<string, unknown>;

    // Get full properties from source via MapElement (handles MapLibre's limited properties)
    let properties: Record<string, unknown>;
    if (mapElement) {
      properties = (mapElement as any).getFullFeatureProperties(
        sourceId,
        partialProps,
        idProperties
      );
    } else {
      properties = partialProps;
    }

    // Get coordinates from feature geometry or click position
    const featureCoords = (feature.geometry as { coordinates?: number[] })?.coordinates;
    const coordinates =
      featureCoords && featureCoords.length >= 2
        ? { lng: featureCoords[0], lat: featureCoords[1] }
        : e.lngLat || { lng: 0, lat: 0 };

    // Notify callback before showing popup
    if (onFeatureClick) {
      onFeatureClick(feature, coordinates);
    }

    // Close existing popup
    if (currentPopup) {
      PopupElement.fadeOutPopup(currentPopup, () => {
        if (onPopupClose) onPopupClose();
      });
      currentPopup = null;
    }

    // Build popup content
    const contentOptions = buildContent(properties, feature);
    if (!contentOptions) return;

    // Show popup
    const popup = PopupElement.showPopupGeneric(map, coordinates, contentOptions, closeButton);

    if (popup) {
      currentPopup = popup;

      if ((popup as any).on) {
        (popup as any).on('close', () => {
          currentPopup = null;
          if (onPopupClose) onPopupClose();
        });
      }

      if (onPopupOpen) {
        onPopupOpen(popup);
      }
    }
  };

  map.on('click', layerId, clickHandler);

  return () => {
    map.off('click', layerId, clickHandler);
    if (currentPopup) {
      PopupElement.fadeOutPopup(currentPopup);
      currentPopup = null;
    }
  };
}
