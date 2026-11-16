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


export class MapBase extends BaseElement {
  static observedAttributes = [
    'map-id',
    'lat',
    'lng',
    'zoom',
    'min-zoom',
    'max-zoom',
    'style',
    'pitch',
    'max-pitch',
    'bearing',
    'max-bearing',
    'bearing-clamp-max-zoom',
    'interactive',
    'hide-controls',
    'auto-hide-controls',
    'show-attribution',
    'provider',
    'sync-url',
    'theme',
    'terrain-min-zoom',
    'terrain-source-url',
    'terrain-exaggeration',
    'terrain-enabled',
    'buildings-min-zoom',
    'buildings-enabled',
    'hillshade-enabled',
    'hillshade-opacity',
    'compact-points',
    'point-scale',
  ];

  protected _controlsVisible: boolean = true;
  protected _mouseEnterHandler: (() => void) | null = null;
  protected _mouseLeaveHandler: (() => void) | null = null;
  protected _isFrozen: boolean = false;
  protected _isUnfreezing: boolean = false; // Prevent race conditions
  protected _freezeInFlight: Promise<void> | null = null;
  protected _detachedFreezeTimer: ReturnType<typeof setTimeout> | null = null;
  protected _isInitializing: boolean = false; // Prevent concurrent initialization
  protected _frozenContainerStyle: { display?: string; visibility?: string } | null = null;
  protected _mapCanvas: HTMLCanvasElement | null = null;
  protected _currentTheme: Theme = darkTheme;

  // System theme detection
  protected _systemThemeMediaQuery: MediaQueryList | null = null;
  protected _systemThemeHandler: ((e: MediaQueryListEvent) => void) | null = null;
  protected _usingSystemTheme: boolean = false;

  // URL sync state
  protected _urlSyncEnabled: boolean = false;
  protected _urlSyncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  protected _hashChangeHandler: (() => void) | null = null;
  protected _mapMoveEndHandler: (() => void) | null = null;
  protected _semanticEventsCleanup: (() => void) | null = null;
  protected _isUpdatingFromUrl: boolean = false; // Prevent circular updates

  // Child element tracking
  protected _childObserver: MutationObserver | null = null;
  protected _trackedChildren: Map<string, Set<HTMLElement>> = new Map();

  /** Restore timeout and original console methods after style-load (MapTiler SDK message suppression). */
  protected _styleLoadConsoleRestoreTimeout: ReturnType<typeof setTimeout> | null = null;
  protected _styleLoadOriginalWarn: typeof console.warn | null = null;
  protected _styleLoadOriginalError: typeof console.error | null = null;

  /** Handler for styleimagemissing so we can remove it before map.remove() */
  protected _styleImageMissingHandler: ((e: { id: string }) => void) | null = null;

  /** Window error handler to suppress MapTiler "unknown feature value" (thrown async during coalesceChanges/render) */
  protected _maptilerErrorHandler: ((event: ErrorEvent) => void) | null = null;

  /** Terrain: zoom handler for toggling 3D terrain; removed in removeAllMapListeners */
  protected _terrainZoomHandler: (() => void) | null = null;

  /** Buildings: zoom handler for toggling 3D buildings; removed in removeAllMapListeners */
  protected _buildingsZoomHandler: (() => void) | null = null;

  /** Hillshade: update handler for toggling hand-drawn hillshade overlay; removed in removeAllMapListeners */
  protected _hillshadeUpdateHandler: (() => void) | null = null;

  /** Bearing clamp: moveend handler to keep map mostly upright; removed in removeAllMapListeners */
  protected _bearingClampHandler: (() => void) | null = null;

  /** One-shot timeout: when placeholder shows Loading/Restoring, fire gk-map-stuck if still not ready after this ms */
  protected _stuckCheckTimer: ReturnType<typeof setTimeout> | null = null;
  protected static readonly STUCK_PLACEHOLDER_MS = STUCK_MS;

  /** True when this element's map instance is counted toward the page WebGL budget. */
  protected _registeredForWebGLBudget = false;

  /** True after map has fired 'idle' (tiles painted). Used by map-collection for status. */
  public hasPainted: boolean = false;

  /** Polls isStyleLoaded when the MapLibre `load` event is slow; cleared on teardown/freeze. */
  protected _styleLoadPollInterval: number | null = null;

  protected clearStyleLoadPoll(): void {
    if (this._styleLoadPollInterval != null) {
      window.clearInterval(this._styleLoadPollInterval);
      this._styleLoadPollInterval = null;
    }
  }

  constructor() {
    super();
    this.map = null;
    this.isInitialized = false;
    // Do not set attributes or style here: custom element constructors must not
    // modify the DOM or the browser throws NotSupportedError ("result must not have attributes").
    // Style is applied in connectedCallback.
  }

}
