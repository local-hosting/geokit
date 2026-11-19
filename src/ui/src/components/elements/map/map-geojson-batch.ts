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

import { MapBoundsFlyto } from './map-bounds-flyto';
import type { MapElement } from './map-static-factory';

export class MapGeojsonBatch extends MapBoundsFlyto {
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
    // Lazy-resolve PointElement to avoid statically importing point.js (~292 KB)
    const PointCls = customElements.get('gk-point') as any;
    if (!PointCls?.createFromGeoJSON) {
      console.warn('[gk-map] gk-point not registered. Import point element first.');
      return 0;
    }
    const points = PointCls.createFromGeoJSON(geojson, options) as PointElement[];
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
    // Lazy-resolve PolygonElement to avoid static import of @turf/simplify
    const PolygonCls = customElements.get('gk-polygon') as any;
    if (!PolygonCls?.createFromGeoJSON) {
      console.warn('[gk-map] gk-polygon not registered. Import polygon element first.');
      return 0;
    }
    const polygons = PolygonCls.createFromGeoJSON(geojson, options) as PolygonElement[];
    // Batch append using DocumentFragment for better performance
    if (polygons.length > 0) {
      const fragment = document.createDocumentFragment();
      polygons.forEach((polygon: PolygonElement) => fragment.appendChild(polygon));
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
    // Lazy-resolve PolygonElement to avoid static import of @turf/simplify
    const PolygonCls = customElements.get('gk-polygon') as any;
    if (!PolygonCls?.createFromGeoJSON) {
      console.warn('[gk-map] gk-polygon not registered. Import polygon element first.');
      return 0;
    }
    const fragment = document.createDocumentFragment();
    let totalCount = 0;

    for (const { geojson, options } of features) {
      const polygons = PolygonCls.createFromGeoJSON(geojson, options) as PolygonElement[];
      polygons.forEach((polygon: PolygonElement) => fragment.appendChild(polygon));
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
    if (data == null) return false;

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
   * Build a layer spec with undefined/null omitted.
   * Root cause: MapTiler coalesceChanges does Object.keys/entries on layout/paint;
   * null/undefined throws "Cannot convert undefined or null to object".
   */
  protected _layerSpecWithoutUndefined(
    layerConfig: Record<string, unknown>,
    layerId: string,
    sourceId: string
  ): Record<string, unknown> {
    const spec: Record<string, unknown> = {
      ...layerConfig,
      id: layerId,
      source: sourceId,
    };
    for (const key of Object.keys(spec)) {
      if (spec[key] == null) delete spec[key];
    }
    if (spec.layout != null && typeof spec.layout === 'object' && !Array.isArray(spec.layout)) {
      const layout: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(spec.layout as Record<string, unknown>)) {
        if (v != null) layout[k] = v;
      }
      spec.layout = layout;
    }
    if (spec.paint != null && typeof spec.paint === 'object' && !Array.isArray(spec.paint)) {
      const paint: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(spec.paint as Record<string, unknown>)) {
        if (v != null) paint[k] = v;
      }
      spec.paint = paint;
    }
    return spec;
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
}
