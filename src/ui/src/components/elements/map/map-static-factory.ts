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

import { MapControlsApi } from './map-controls-api';
import { registerGkMapViteHmrHandlers } from '../../../bootstrap/vite-gk-map-hmr';

export class MapElement extends MapControlsApi {
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
    // Must use createElement so the browser uses the registered custom element constructor (new MapElement() throws Illegal constructor once defined).
    // Use exactly one argument: some environments throw NotSupportedError if a second argument (e.g. options) is passed.
    let map: MapElement;
    try {
      map = document.createElement('gk-map') as MapElement;
    } catch {
      // Fallback when createElement('gk-map') throws (e.g. cached bundle passing options, or strict UA)
      const wrap = document.createElement('div');
      wrap.innerHTML = '<gk-map></gk-map>';
      const el = wrap.firstElementChild;
      if (!el) throw new Error('Failed to create gk-map');
      map = el as MapElement;
    }

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

    // Add controls only if the instance has addControl (always true when create() uses createElement)
    if (typeof map.addControl === 'function') {
      for (const controlConfig of controls) {
        map.addControl(controlConfig);
      }
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

registerGkMapViteHmrHandlers();

