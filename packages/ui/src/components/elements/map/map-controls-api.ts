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

import { MapSourceLayers } from './map-source-layers.js';

export class MapControlsApi extends MapSourceLayers {
  public addControl(config: {
    /** Control type (e.g., 'navigation', 'fullscreen', 'scale', 'geolocate') */
    type: string;
    /** Control position (e.g., 'top-right', 'bottom-left') */
    position?: string;
    /** Additional attributes to set on the control */
    attributes?: Record<string, string>;
  }): HTMLElement | null {
    const ControlClass = customElements.get(`gk-control-${config.type}`);
    if (!ControlClass) {
      console.warn(`[gk-map] Control type not found: gk-control-${config.type}`);
      return null;
    }

    const control = new ControlClass() as HTMLElement;

    // Set position if provided
    if (config.position) {
      control.setAttribute('position', config.position);
    }

    // Set additional attributes
    if (config.attributes) {
      for (const [key, value] of Object.entries(config.attributes)) {
        control.setAttribute(key, value);
      }
    }

    this.appendChild(control);
    return control;
  }

  /**
   * Add multiple controls at once
   * @param configs - Array of control configurations
   * @returns Array of created control elements (nulls filtered out)
   */
  public addControls(
    configs: Array<{
      type: string;
      position?: string;
      attributes?: Record<string, string>;
    }>
  ): HTMLElement[] {
    return configs
      .map((config) => this.addControl(config))
      .filter((control): control is HTMLElement => control !== null);
  }

  // ============================================================================
  // Factory Method for Programmatic Creation
  // ============================================================================

  /**
   * Create a MapElement programmatically with options
   * @param options - Map creation options
   * @returns New MapElement instance
   */
}
