/**
 * Map Utilities
 *
 * Common utilities for working with map elements and instances.
 * These utilities complement MapChildElement.findMapElementFromInstance()
 * by providing the reverse operations (element → instance, find element in DOM).
 */

import type { MapInstance } from '../providers/types';
import type { Feature, FeatureCollection } from '../../types';
import { getFeatureId } from '../../utils/geojson';

/**
 * Get map instance from a gk-map element
 * @param element The gk-map element
 * @returns The map instance or null if not available
 */
export function getMapInstance(element: HTMLElement | null): any | null {
  if (!element) return null;
  return (element as any).getMap?.() || null;
}

/**
 * Find gk-map element in DOM tree starting from given element
 * Traverses up the DOM tree to find the nearest parent gk-map element.
 *
 * This is the reverse of MapChildElement.findMapElementFromInstance(),
 * which finds the element from a map instance.
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
 * Get map instance from element or find parent map element first
 * Convenience function that combines findMapElement() and getMapInstance()
 *
 * @param element Element to start from (can be any element, not just gk-map)
 * @returns The map instance or null if not available
 */
export function getMapInstanceFromElement(element: HTMLElement | null): any | null {
  const mapElement = findMapElement(element);
  return getMapInstance(mapElement);
}

// ============================================================================
// Source Management Utilities (work directly with MapInstance)
// ============================================================================

/**
 * Update GeoJSON source data in place (avoids flicker from remove/add)
 * Works directly with MapInstance, not requiring MapElement
 * @param map - MapInstance (MapLibre map)
 * @param sourceId - Source ID to update
 * @param data - New GeoJSON FeatureCollection data
 * @returns true if update succeeded, false otherwise
 */
export function updateSourceData(
  map: MapInstance | null,
  sourceId: string,
  data: FeatureCollection
): boolean {
  if (!map) return false;

  const source = map.getSource?.(sourceId);
  if (!source) {
    console.warn(`[geokit] Source not found: ${sourceId}`);
    return false;
  }

  // Check if source has setData method (GeoJSON sources should have this)
  if (typeof (source as any).setData === 'function') {
    try {
      (source as any).setData(data);
      return true;
    } catch (error) {
      console.error(`[geokit] Failed to update source data:`, error);
      return false;
    }
  }

  console.warn(`[geokit] Source ${sourceId} does not support setData() method`);
  return false;
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
    // Some map SDKs return false from isStyleLoaded() even when style is functional
    // So we also check if getStyle() returns a valid style object
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
      // Double-check style is loaded
      const loaded = typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : true;
      if (loaded) {
        handleResolve();
      }
    };

    const styleLoadHandler = () => {
      // Double-check style is loaded
      const loaded = typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : true;
      if (loaded) {
        handleResolve();
      }
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
      // Fallback if 'on' method doesn't exist
      handleResolve(); // Assume loaded if we can't listen for events
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
// GeoJSON Data Utilities
// ============================================================================

/**
 * Get GeoJSON data from a source
 * Handles both _data and _geojson internal properties
 * @param map - MapInstance
 * @param sourceId - Source ID
 * @returns GeoJSON FeatureCollection data or null if not found
 */
export function getSourceData(map: MapInstance | null, sourceId: string): FeatureCollection | null {
  if (!map) return null;

  const source = map.getSource?.(sourceId);
  if (!source || (source as any).type !== 'geojson') return null;

  const data = (source as any)._data || (source as any)._geojson;
  if (!data?.features) return null;

  return data as FeatureCollection;
}

/**
 * Find a feature by ID in a source
 * @param map - MapInstance
 * @param sourceId - Source ID to search
 * @param featureId - Feature ID to find (checks properties.id, properties.slug, etc.)
 * @param idProperties - Optional array of property names to check for ID (default: ['id', 'slug'])
 * @returns Feature if found, null otherwise
 */
export function findFeatureById(
  map: MapInstance | null,
  sourceId: string,
  featureId: string,
  idProperties: string[] = ['id', 'slug']
): Feature | null {
  const data = getSourceData(map, sourceId);
  if (!data) return null;

  return (
    data.features.find((f: Feature) => {
      if (!f.properties) return false;
      return idProperties.some((prop) => f.properties?.[prop] === featureId);
    }) || null
  );
}

/**
 * Get full feature properties from source
 * MapLibre may return limited properties from queryRenderedFeatures,
 * so this looks up the full feature from the source
 * @param map - MapInstance
 * @param sourceId - Source ID
 * @param partialProperties - Partial properties from queryRenderedFeatures
 * @param idProperties - Optional array of property names to check for ID
 * @returns Full feature properties or partial if not found
 */
export function getFullFeatureProperties(
  map: MapInstance | null,
  sourceId: string,
  partialProperties: Record<string, unknown>,
  idProperties: string[] = ['id', 'slug']
): Record<string, unknown> {
  // Try to find feature ID from partial properties
  const featureId = idProperties.find((prop) => partialProperties[prop]) as string | undefined;

  if (!featureId || !partialProperties[featureId]) {
    return partialProperties;
  }

  const fullFeature = findFeatureById(
    map,
    sourceId,
    String(partialProperties[featureId]),
    idProperties
  );

  if (fullFeature?.properties) {
    return fullFeature.properties;
  }

  return partialProperties;
}

// ============================================================================
// Layer Management Utilities (work directly with MapInstance)
// ============================================================================

/**
 * Set visibility for a single layer
 * Works directly with MapInstance, not requiring MapElement
 * @param map - MapInstance
 * @param layerId - Layer ID
 * @param visible - Whether layer should be visible
 * @returns true if operation succeeded, false otherwise
 */
export function setLayerVisibility(
  map: MapInstance | null,
  layerId: string,
  visible: boolean
): boolean {
  if (!map?.getLayer?.(layerId)) {
    return false;
  }

  try {
    map.setLayoutProperty?.(layerId, 'visibility', visible ? 'visible' : 'none');
    return true;
  } catch (error) {
    console.error(`[geokit] Failed to set layer visibility:`, error);
    return false;
  }
}

/**
 * Set visibility for multiple layers at once
 * @param map - MapInstance
 * @param layerIds - Array of layer IDs
 * @param visible - Whether layers should be visible
 */
export function setLayersVisibility(
  map: MapInstance | null,
  layerIds: string[],
  visible: boolean
): void {
  layerIds.forEach((id) => setLayerVisibility(map, id, visible));
}

/**
 * Update layer filter expression
 * Universal method to apply MapLibre filter expressions to layers
 * @param map - MapInstance
 * @param layerId - Layer ID
 * @param filterExpression - MapLibre filter expression
 * @returns true if update succeeded, false otherwise
 */
export function setLayerFilter(
  map: MapInstance | null,
  layerId: string,
  filterExpression: unknown[]
): boolean {
  if (!map?.getLayer || !(map as any).setFilter) return false;

  try {
    if (map.getLayer(layerId)) {
      (map as any).setFilter(layerId, filterExpression);
      return true;
    }
  } catch (error) {
    console.warn(`[geokit] Failed to set filter for layer: ${layerId}`, error);
  }

  return false;
}

// ============================================================================
// Selection Management Utilities (work directly with MapInstance)
// ============================================================================

/**
 * Update selection state in a GeoJSON source
 * Sets a selection property on the selected feature, removes from others
 * @param map - MapInstance
 * @param sourceId - Source ID to update
 * @param selectedId - Feature ID to select (null to clear selection)
 * @param selectionProperty - Property name to use for selection (default: '__selected')
 * @param idProperties - Optional array of property names to check for ID
 * @returns true if update was successful
 */
export function updateFeatureSelection(
  map: MapInstance | null,
  sourceId: string,
  selectedId: string | null,
  selectionProperty: string = '__selected',
  idProperties: string[] = ['id', 'slug']
): boolean {
  const data = getSourceData(map, sourceId);
  if (!data) return false;

  try {
    let foundSelected = false;
    const newFeatures = data.features.map((f: Feature) => {
      // Create a new feature object to trigger reactivity
      const newFeature = JSON.parse(JSON.stringify(f)) as Feature;

      if (!newFeature.properties) {
        newFeature.properties = {};
      }

      // Check if this is the selected feature
      const featureId = getFeatureId(newFeature, idProperties);
      const isSelected = selectedId !== null && featureId === selectedId;

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
      console.warn(`[geokit] Feature ${selectedId} not found in source ${sourceId}`);
    }

    // Update source data
    const success = updateSourceData(map, sourceId, {
      type: 'FeatureCollection',
      features: newFeatures,
    });

    // Force repaint to show selection
    if (success && map) {
      if ((map as any).triggerRepaint) {
        (map as any).triggerRepaint();
      } else if ((map as any).repaint) {
        (map as any).repaint();
      }
    }

    return success;
  } catch (error) {
    console.error(`[geokit] Failed to update selection for source: ${sourceId}`, error);
    return false;
  }
}

// ============================================================================
// Layer Group Management Utilities
// ============================================================================

/**
 * Layer group registry - stores layer groups for a map
 * Allows managing multiple layers as a single unit
 */
const layerGroupRegistry = new WeakMap<MapInstance, Map<string, string[]>>();

/**
 * Create or register a layer group
 * A layer group is a collection of layer IDs that can be managed together
 * @param map - MapInstance
 * @param groupId - Unique identifier for the layer group
 * @param layerIds - Array of layer IDs that belong to this group
 * @returns true if group was created/updated successfully
 */
export function createLayerGroup(
  map: MapInstance | null,
  groupId: string,
  layerIds: string[]
): boolean {
  if (!map) return false;

  let groups = layerGroupRegistry.get(map);
  if (!groups) {
    groups = new Map();
    layerGroupRegistry.set(map, groups);
  }

  groups.set(groupId, [...layerIds]);
  return true;
}

/**
 * Get layer IDs for a layer group
 * @param map - MapInstance
 * @param groupId - Layer group ID
 * @returns Array of layer IDs or null if group doesn't exist
 */
export function getLayerGroup(map: MapInstance | null, groupId: string): string[] | null {
  if (!map) return null;

  const groups = layerGroupRegistry.get(map);
  if (!groups) return null;

  return groups.get(groupId) || null;
}

/**
 * Set visibility for all layers in a group
 * @param map - MapInstance
 * @param groupId - Layer group ID
 * @param visible - Whether layers should be visible
 * @returns true if operation succeeded, false if group doesn't exist
 */
export function setLayerGroupVisibility(
  map: MapInstance | null,
  groupId: string,
  visible: boolean
): boolean {
  if (!map) return false;

  const layerIds = getLayerGroup(map, groupId);
  if (!layerIds) {
    console.warn(`[geokit] Layer group not found: ${groupId}`);
    return false;
  }

  setLayersVisibility(map, layerIds, visible);
  return true;
}

/**
 * Remove a layer group from the registry
 * Note: This does NOT remove the layers from the map, only from the registry
 * @param map - MapInstance
 * @param groupId - Layer group ID
 * @returns true if group was removed
 */
export function removeLayerGroup(map: MapInstance | null, groupId: string): boolean {
  if (!map) return false;

  const groups = layerGroupRegistry.get(map);
  if (!groups) return false;

  return groups.delete(groupId);
}

/**
 * Get all layer group IDs for a map
 * @param map - MapInstance
 * @returns Array of group IDs
 */
export function getLayerGroupIds(map: MapInstance | null): string[] {
  if (!map) return [];

  const groups = layerGroupRegistry.get(map);
  if (!groups) return [];

  return Array.from(groups.keys());
}
