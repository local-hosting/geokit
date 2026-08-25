/**
 * Map Component
 *
 * Main map container component
 *
 * Usage:
 * <gk-map lat="40.7128" lng="-74.006" zoom="10" style="streets"></gk-map>
 */

import { resolveSharedPointLayerIdForSource } from '../../../utils/shared-point-heal.js';
import { BaseElement } from '../../base-element';
import {
  registerUIProvider,
  getProviderByName,
  getUIProviderByName,
} from '../../../providers/registry';
import { MapTilerUIProvider } from '../../../providers/maptiler-provider';
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
import { bindGkMapSemanticEvents } from '../../../utils/map-semantic-events.js';
import {
  offGkMapEvent,
  onGkMapEvent,
  type GkMapEventHandler,
  type GkMapListenEvent,
} from '../../../utils/map-element-on.js';
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

import { MapFreezeRuntime } from './map-freeze-runtime.js';

export class MapBoundsFlyto extends MapFreezeRuntime {

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
      /** Camera transition length in ms; 0 = instant (default). */
      duration?: number;
    } = {}
  ): Promise<void> {
    if (!this.map) {
      throw new Error('[gk-map] No map instance');
    }

    const map = this.map as any;
    const [minLng, minLat, maxLng, maxLat] = bbox;

    if (
      ![minLng, minLat, maxLng, maxLat].every(Number.isFinite) ||
      minLng >= maxLng ||
      minLat >= maxLat
    ) {
      console.warn('[gk-map] setBounds skipped: invalid bbox', bbox);
      return;
    }

    // Default padding
    let padding = options.padding ?? { top: 40, bottom: 40, left: 40, right: 40 };
    const rectForPad = this.getBoundingClientRect();
    const minDim = Math.max(1, Math.min(rectForPad.width, rectForPad.height));
    const maxUniformPad = Math.floor(minDim * 0.2);
    if (typeof padding === 'number') {
      padding = Math.max(8, Math.min(padding, maxUniformPad));
    }
    const pitch = options.pitch ?? 0;
    const bearing = options.bearing ?? 0;
    const duration = Math.max(0, options.duration ?? 0);

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
    safeResizeMap(map, this);

    // Wait a frame for resize to take effect
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const corners: [[number, number], [number, number]] = [
      [minLng, minLat],
      [maxLng, maxLat],
    ];
    const paddingObj =
      typeof padding === 'number'
        ? { top: padding, bottom: padding, left: padding, right: padding }
        : padding;

    const waitForViewportSettle = (): Promise<void> => {
      if (duration <= 0) {
        return new Promise((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        });
      }

      return new Promise((resolve) => {
        const timeoutMs = duration + 250;
        let timeout = 0;
        const finish = () => {
          if (timeout) window.clearTimeout(timeout);
          map.off?.('moveend', finish);
          resolve();
        };
        timeout = window.setTimeout(finish, timeoutMs);
        map.once?.('moveend', finish);
      });
    };

    // Prefer cameraForBounds + easeTo/jumpTo — MapTiler fitBounds can NaN when canvas layout is settling.
    try {
      const camera = map.cameraForBounds?.(corners, {
        padding: paddingObj,
        maxZoom: options.maxZoom ?? 18,
      });
      if (
        camera?.center?.length === 2 &&
        camera.center.every(Number.isFinite) &&
        Number.isFinite(camera.zoom)
      ) {
        const cameraOptions = {
          center: camera.center,
          zoom: camera.zoom,
          bearing: camera.bearing ?? bearing,
          pitch: camera.pitch ?? pitch,
          duration,
        };
        if (duration > 0) {
          const animated = {
            ...cameraOptions,
            essential: true,
            ...(duration >= 1000 ? { curve: 1.42 } : {}),
          };
          if (typeof map.flyTo === 'function') {
            map.flyTo(animated);
          } else {
            map.easeTo?.(animated);
          }
        } else {
          map.jumpTo?.(cameraOptions);
        }
      } else if (duration > 0) {
        map.fitBounds(corners, {
          padding: paddingObj,
          pitch,
          bearing,
          duration,
          maxZoom: options.maxZoom,
        });
      } else {
        map.fitBounds(corners, {
          padding: paddingObj,
          pitch,
          bearing,
          duration: 0,
          maxZoom: options.maxZoom,
        });
      }

      // Force repaint
      if (typeof map.triggerRepaint === 'function') {
        map.triggerRepaint();
      }

      await waitForViewportSettle();
    } catch (error) {
      console.warn('[gk-map] Error in setBounds:', error);
      // Fallback to center
      const centerLng = (minLng + maxLng) / 2;
      const centerLat = (minLat + maxLat) / 2;
      try {
        if (duration > 0) {
          map.easeTo?.({ center: [centerLng, centerLat], pitch, bearing, duration });
          await waitForViewportSettle();
        } else {
          map.jumpTo?.({ center: [centerLng, centerLat], pitch, bearing });
        }
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
}
