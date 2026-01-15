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
export function getMapInstanceFromElement(
  element: HTMLElement | null
): any | null {
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

  console.warn(
    `[geokit] Source ${sourceId} does not support setData() method`
  );
  return false;
}

/**
 * Get GeoJSON data from a source
 * Handles both _data and _geojson internal properties
 * @param map - MapInstance
 * @param sourceId - Source ID
 * @returns GeoJSON FeatureCollection data or null if not found
 */
export function getSourceData(
  map: MapInstance | null,
  sourceId: string
): FeatureCollection | null {
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
      return idProperties.some(prop => f.properties?.[prop] === featureId);
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
  const featureId = idProperties.find(
    prop => partialProperties[prop]
  ) as string | undefined;

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
    map.setLayoutProperty?.(
      layerId,
      'visibility',
      visible ? 'visible' : 'none'
    );
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
      console.warn(
        `[geokit] Feature ${selectedId} not found in source ${sourceId}`
      );
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
    console.error(
      `[geokit] Failed to update selection for source: ${sourceId}`,
      error
    );
    return false;
  }
}

