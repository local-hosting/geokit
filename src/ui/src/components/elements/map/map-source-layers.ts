/**
 * Map Component
 *
 * Main map container component
 *
 * Usage:
 * <gk-map lat="40.7128" lng="-74.006" zoom="10" style="streets"></gk-map>
 */

import { resolveSharedPointLayerIdForSource } from '../../../utils/shared-point-heal';
import { BaseElement } from '../../base-element';
import {
  registerUIProvider,
  getProviderByName,
  getUIProviderByName,
} from '../../../providers/registry';
import type { PointElement } from '../point/point';
import type { PolygonElement } from '../polygon';
import { type IsochroneElement } from '../isochrone/isochrone';
import type { MapInstance } from '../../../providers/types';
import {
  type ThemeName,
  type Theme,
  getTheme,
  isValidTheme,
  injectThemeStyles,
  darkTheme,
  getSystemTheme,
  getSystemThemeMediaQuery,
} from '../../../utils/theme';
import { debug } from '../../../utils/logger';
import {
  STUCK_PLACEHOLDER_MS as STUCK_MS,
  createPlaceholderContent as createPlaceholderContentFn,
  MAP_PLACEHOLDER_STYLE,
  getPlaceholderSelector,
} from './style/map-placeholder';
import {
  injectHideAttributionStyles as injectHideAttributionStylesFn,
  injectAutoHideStyles as injectAutoHideStylesFn,
  isMaplibreLayoutCssLoaded,
} from './style/map-controls-styles';
import {
  parseUrlHashState as parseUrlHashStateFn,
  buildHashFromState,
  applyStateToMap,
} from './surface/map-url-sync';
import { bindGkMapSemanticEvents } from '../../../utils/map-semantic-events';
import {
  offGkMapEvent,
  onGkMapEvent,
  type GkMapEventHandler,
  type GkMapListenEvent,
} from '../../../utils/map-element-on';
import {
  createTerrainZoomHandler,
  cleanupTerrain as cleanupTerrainFn,
  createBuildingsZoomHandler,
  cleanup3DBuildings as cleanup3DBuildingsFn,
  setupHillshade as setupHillshadeFn,
  cleanupHillshade as cleanupHillshadeFn,
} from './surface/map-terrain-buildings';
import {
  checkAndUpdateStyle as checkAndUpdateStyleFn,
  ensureValidMapStyleAfterLoad as ensureValidMapStyleAfterLoadFn,
  createStyleImageMissingHandler,
} from './style/map-style';
import {
  whenStyleReady as whenStyleReadyFn,
  resizeAndRepaintMap as resizeAndRepaintMapFn,
  delayForWebGLRelease,
  registerLiveMap,
  unregisterLiveMap,
  waitUntilCanCreateMap,
} from './lifecycle/map-freeze';
import { safeResizeMap } from '../../../utils/map-utils';
import { resolveEmbedPointScale } from '../../../utils/embed-point-scale';
import {
  filterPoints as filterPointsFn,
  filterPolygons as filterPolygonsFn,
  filterIsochrones as filterIsochronesFn,
} from './surface/map-children';
import {
  setSharedPointSelection,
  getSharedPointSelection,
  clearSharedPointSelection,
  DEFAULT_SHARED_POINT_ID_PROPERTIES,
} from '../../../utils/layer-styles';

import { MapGeojsonBatch } from './map-geojson-batch';

export class MapSourceLayers extends MapGeojsonBatch {
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
          const spec = this._layerSpecWithoutUndefined(layerConfig, layerId, sourceId);
          if (beforeId != null) {
            map.addLayer(spec as any, beforeId);
          } else {
            map.addLayer(spec as any);
          }
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
        const spec = this._layerSpecWithoutUndefined(layerConfig, layerId, sourceId);
        if (beforeId != null) {
          map.addLayer(spec as any, beforeId);
        } else {
          map.addLayer(spec as any);
        }
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
   * Move the selection ring on a shared point layer (from createSharedPointLayers).
   * @param sourceId - Base source ID used when creating the shared point layers
   * @param featureId - Feature id to select, or null to clear
   * @param lngLat - Optional coordinates; when omitted, resolved from source data
   * @param idProperties - Property names to match featureId in source features
   */
  public setSelectedPoint(
    sourceId: string,
    featureId: string | null,
    lngLat?: { lng: number; lat: number } | null,
    idProperties: string[] = DEFAULT_SHARED_POINT_ID_PROPERTIES
  ): boolean {
    const map = this.getMap();
    if (!map) return false;

    if (featureId === null) {
      clearSharedPointSelection(map, sourceId, {
        mapElement: this,
        dispatchEvent: true,
      });
      return true;
    }

    let coords = lngLat ?? null;
    let properties: Record<string, unknown> | undefined;
    const feature = this.findFeatureById(sourceId, featureId, idProperties);
    if (!coords) {
      coords = this.pointCoordsFromFeature(feature);
    }
    if (feature?.properties && typeof feature.properties === 'object') {
      properties = { ...(feature.properties as Record<string, unknown>) };
    }
    if (!coords) return false;

    setSharedPointSelection(
      map,
      sourceId,
      { featureId, lngLat: coords, properties },
      {
        mapElement: this,
        dispatchEvent: true,
        pointLayerId: resolveSharedPointLayerIdForSource(map, sourceId),
      }
    );
    return true;
  }

  /**
   * Read the current shared-point selection for a source (ring + tracked id).
   */
  public getSelectedPoint(
    sourceId: string
  ): { featureId: string; lngLat: { lng: number; lat: number } } | null {
    const map = this.getMap();
    if (!map) return null;
    const state = getSharedPointSelection(map, sourceId);
    if (!state?.featureId || !state.lngLat) return null;
    return { featureId: state.featureId, lngLat: state.lngLat };
  }

  /**
   * Clear shared-point selection. When sourceId is omitted, clears all tracked sources on this map.
   */
  public clearSelectedPoint(sourceId?: string): boolean {
    const map = this.getMap();
    if (!map) return false;

    if (sourceId) {
      clearSharedPointSelection(map, sourceId, {
        mapElement: this,
        dispatchEvent: true,
      });
      return true;
    }

    // No registry of all sourceIds — callers should pass sourceId when known.
    return false;
  }

  protected pointCoordsFromFeature(
    feature: GeoJSON.Feature | null
  ): { lng: number; lat: number } | null {
    const geometry = feature?.geometry;
    if (geometry?.type === 'Point' && 'coordinates' in geometry) {
      const coords = geometry.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
          return { lng, lat };
        }
      }
    }
    return null;
  }

  /**
   * @deprecated For shared point layers (createSharedPointLayers), use setSelectedPoint()
   * which moves the dedicated selection ring without mutating point source data.
   *
   * Legacy: update selection state in a GeoJSON source by setting __selected on features.
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
      // Capture previous selected id for event (before we mutate)
      let previousSelectedId: string | null = null;
      for (const f of data.features) {
        const props = (f as GeoJSON.Feature).properties;
        if (props?.[selectionProperty]) {
          const id = idProperties.map((p) => props[p]).find((v) => v != null);
          if (id != null) {
            previousSelectedId = String(id);
            break;
          }
        }
      }

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
        this.dispatchEvent(
          new CustomEvent('gk-feature-selection-changed', {
            detail: { sourceId, selectedId, previousSelectedId },
            bubbles: true,
          })
        );
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
}
