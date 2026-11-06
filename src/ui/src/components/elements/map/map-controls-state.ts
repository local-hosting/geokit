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
import { MapTilerUIProvider } from '../../../providers/maptiler-provider';
import type { PointElement } from '../point/point';
import type { PolygonElement } from '../polygon';
import { type IsochroneElement } from '../isochrone/isochrone';
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

import { applyMapCameraAttribute } from './map-camera-attribute';
import { MapStyleSetup } from './map-style-setup';
import { mapEl } from './map-el';

export class MapControlsState extends MapStyleSetup {
  public setControlsVisible(visible: boolean): void {
    this._controlsVisible = visible;

    if (visible) {
      this.classList.remove('gk-controls-hidden');
    } else {
      this.classList.add('gk-controls-hidden');
    }

    this.dispatchEvent(
      new CustomEvent('controls-visibility-change', {
        detail: { visible },
        bubbles: true,
      })
    );
  }

  /**
   * Check if controls are currently visible
   */
  public areControlsVisible(): boolean {
    return this._controlsVisible;
  }

  /**
   * Toggle controls visibility
   */
  public toggleControls(): void {
    this.setControlsVisible(!this._controlsVisible);
  }

  protected handleAttributeChange(
    name: string,
    _oldValue: string | null,
    newValue: string | null
  ): void {
    // Handle auto-hide-controls toggle (doesn't require map)
    if (name === 'auto-hide-controls') {
      if (newValue !== null) {
        this.setupAutoHideControls();
      } else {
        this.cleanupAutoHideControls();
        this.setControlsVisible(true);
      }
      return;
    }

    // Terrain toggle from Layers sidebar: re-run terrain logic when terrain-enabled changes
    if (name === 'terrain-enabled' && this._terrainZoomHandler) {
      this._terrainZoomHandler();
      return;
    }

    // Buildings toggle from Layers sidebar: re-run buildings logic when buildings-enabled changes
    if (name === 'buildings-enabled' && this._buildingsZoomHandler) {
      this._buildingsZoomHandler();
      return;
    }

    // Hillshade toggle: re-run hillshade logic when hillshade-enabled changes
    if (name === 'hillshade-enabled') {
      if (this._hillshadeUpdateHandler) {
        this._hillshadeUpdateHandler();
      } else if (newValue !== null && newValue !== 'false') {
        this.setupHillshade();
      }
      return;
    }

    // Handle sync-url toggle
    if (name === 'sync-url') {
      if (newValue !== null && this.isInitialized) {
        this.setupUrlSync();
      } else {
        this.cleanupUrlSync();
      }
      return;
    }

    // Handle theme change (class-based; CSS from injected stylesheet)
    if (name === 'theme') {
      if (newValue && isValidTheme(newValue)) {
        // Explicit theme set - stop listening to system theme
        this._usingSystemTheme = false;
        this.cleanupSystemThemeListener();
        this._currentTheme = getTheme(newValue);
        this.syncThemeClass();
        if (this.map && this.isInitialized) {
          mapEl(this).updateMapStyle(this._currentTheme.mapStyle);
        }
        this.dispatchEvent(
          new CustomEvent('gk-theme-change', {
            detail: { theme: this._currentTheme, themeName: newValue },
            bubbles: true,
          })
        );
      } else if (!newValue && !this.getAttribute('map-style')) {
        // Theme attribute removed and no explicit map-style - revert to system theme
        this._usingSystemTheme = true;
        const systemThemeName = getSystemTheme();
        this._currentTheme = getTheme(systemThemeName);
        this.syncThemeClass();
        this.setupSystemThemeListener();
        if (this.map && this.isInitialized) {
          mapEl(this).updateMapStyle(this._currentTheme.mapStyle);
        }
      } else {
        this.syncThemeClass();
      }
      return;
    }

    if (!this.map) return;

    switch (name) {
      case 'lat':
      case 'lng':
      case 'zoom':
      case 'pitch':
      case 'bearing':
        applyMapCameraAttribute(
          this.map,
          name,
          this.getAttribute('lat'),
          this.getAttribute('lng'),
          newValue,
        );
        break;
      default:
        break;
    }
  }

  // Public API
}