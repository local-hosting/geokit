/**
 * Map Component
 *
 * Main map container component
 *
 * Usage:
 * <gk-map lat="40.7128" lng="-74.006" zoom="10" style="streets"></gk-map>
 */

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
} from './map-placeholder';
import {
  injectHideAttributionStyles as injectHideAttributionStylesFn,
  injectAutoHideStyles as injectAutoHideStylesFn,
  isMaplibreLayoutCssLoaded,
} from './map-controls-styles';
import {
  parseUrlHashState as parseUrlHashStateFn,
  buildHashFromState,
  applyStateToMap,
} from './map-url-sync';
import {
  createTerrainZoomHandler,
  cleanupTerrain as cleanupTerrainFn,
  createBuildingsZoomHandler,
  cleanup3DBuildings as cleanup3DBuildingsFn,
  setupHillshade as setupHillshadeFn,
  cleanupHillshade as cleanupHillshadeFn,
} from './map-terrain-buildings';
import {
  checkAndUpdateStyle as checkAndUpdateStyleFn,
  ensureValidMapStyleAfterLoad as ensureValidMapStyleAfterLoadFn,
  createStyleImageMissingHandler,
} from './map-style';
import {
  whenStyleReady as whenStyleReadyFn,
  resizeAndRepaintMap as resizeAndRepaintMapFn,
  delayForWebGLRelease,
} from './map-freeze';
import { safeResizeMap } from '../../../utils/map-utils';
import { resolveEmbedPointScale } from '../../../utils/embed-point-scale';
import {
  filterPoints as filterPointsFn,
  filterPolygons as filterPolygonsFn,
  filterIsochrones as filterIsochronesFn,
} from './map-children';
import {
  setSharedPointSelection,
  getSharedPointSelection,
  clearSharedPointSelection,
  DEFAULT_SHARED_POINT_ID_PROPERTIES,
} from '../../../utils/layer-styles';

export class MapElement extends BaseElement {
  static observedAttributes = [
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

  private _controlsVisible: boolean = true;
  private _mouseEnterHandler: (() => void) | null = null;
  private _mouseLeaveHandler: (() => void) | null = null;
  private _isFrozen: boolean = false;
  private _isUnfreezing: boolean = false; // Prevent race conditions
  private _isInitializing: boolean = false; // Prevent concurrent initialization
  private _frozenContainerStyle: { display?: string; visibility?: string } | null = null;
  private _mapCanvas: HTMLCanvasElement | null = null;
  private _currentTheme: Theme = darkTheme;

  // System theme detection
  private _systemThemeMediaQuery: MediaQueryList | null = null;
  private _systemThemeHandler: ((e: MediaQueryListEvent) => void) | null = null;
  private _usingSystemTheme: boolean = false;

  // URL sync state
  private _urlSyncEnabled: boolean = false;
  private _urlSyncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _hashChangeHandler: (() => void) | null = null;
  private _mapMoveEndHandler: (() => void) | null = null;
  private _isUpdatingFromUrl: boolean = false; // Prevent circular updates

  // Child element tracking
  private _childObserver: MutationObserver | null = null;
  private _trackedChildren: Map<string, Set<HTMLElement>> = new Map();

  /** Restore timeout and original console methods after style-load (MapTiler SDK message suppression). */
  private _styleLoadConsoleRestoreTimeout: ReturnType<typeof setTimeout> | null = null;
  private _styleLoadOriginalWarn: typeof console.warn | null = null;
  private _styleLoadOriginalError: typeof console.error | null = null;

  /** Handler for styleimagemissing so we can remove it before map.remove() */
  private _styleImageMissingHandler: ((e: { id: string }) => void) | null = null;

  /** Window error handler to suppress MapTiler "unknown feature value" (thrown async during coalesceChanges/render) */
  private _maptilerErrorHandler: ((event: ErrorEvent) => void) | null = null;

  /** Terrain: zoom handler for toggling 3D terrain; removed in removeAllMapListeners */
  private _terrainZoomHandler: (() => void) | null = null;

  /** Buildings: zoom handler for toggling 3D buildings; removed in removeAllMapListeners */
  private _buildingsZoomHandler: (() => void) | null = null;

  /** Hillshade: update handler for toggling hand-drawn hillshade overlay; removed in removeAllMapListeners */
  private _hillshadeUpdateHandler: (() => void) | null = null;

  /** Bearing clamp: moveend handler to keep map mostly upright; removed in removeAllMapListeners */
  private _bearingClampHandler: (() => void) | null = null;

  /** One-shot timeout: when placeholder shows Loading/Restoring, fire gk-map-stuck if still not ready after this ms */
  private _stuckCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly STUCK_PLACEHOLDER_MS = STUCK_MS;

  /** True after map has fired 'idle' (tiles painted). Used by map-collection for status. */
  public hasPainted: boolean = false;

  constructor() {
    super();
    this.map = null;
    this.isInitialized = false;
    // Do not set attributes or style here: custom element constructors must not
    // modify the DOM or the browser throws NotSupportedError ("result must not have attributes").
    // Style is applied in connectedCallback.
  }

  async connectedCallback(): Promise<void> {
    // Apply default layout style once when connected (spec forbids this in constructor)
    if (!this.style.display || this.style.display === 'inline') {
      this.style.display = 'block';
    }
    if (!this.style.width) {
      this.style.width = '100%';
    }
    if (!this.style.height) {
      this.style.height = '100%';
    }
    if (!this.style.position || this.style.position === 'static') {
      this.style.position = 'relative';
    }

    // Initialize child element tracking
    this._initializeChildTracking();

    // Check if inside a gk-map-collection FIRST - collection manages placeholder timing
    // to avoid showing "Loading map..." during scroll
    const parentCollection = this.closest('gk-map-collection');
    if (parentCollection) {
      // Mark as pool-managed so we don't try again
      this.setAttribute('data-pool-managed', 'true');
      return;
    }

    // If map is pool-managed (has data-pool-managed attribute), don't auto-initialize
    // It will be initialized explicitly via activateMap()
    if (this.hasAttribute('data-pool-managed')) {
      return;
    }

    // Only show placeholder for standalone maps (not pool-managed)
    this.showPlaceholderIfNeeded();

    // Prevent re-initialization if map already exists (important for map pool reuse)
    // When maps are moved between cards, connectedCallback can be called again,
    // but we should reuse the existing map instance to avoid creating new WebGL contexts
    if (!this.isInitialized && !this.map) {
      await this.initializeMap();
    } else if (this.map && !this.isInitialized) {
      // Map exists but not marked as initialized - mark it as initialized
      // This can happen if the map was created but the load event hasn't fired yet
      this.isInitialized = true;
      this.hidePlaceholder();
    }
  }

  /**
   * Override disconnectedCallback to preserve map instance when element is moved
   * This is critical for map pool reuse - we don't want to destroy the map instance
   * when the element is moved between cards, only when it's permanently removed
   *
   * For map pool reuse, we preserve the map instance so it can be reused.
   * The map will only be cleaned up if explicitly removed via remove() or similar.
   */
  disconnectedCallback(): void {
    // Clean up auto-hide listeners
    this.cleanupAutoHideControls();

    // Clean up URL sync listeners
    this.cleanupUrlSync();

    // Clean up system theme listener
    this.cleanupSystemThemeListener();

    this._cleanupChildTracking();
    this._clearStuckCheck();

    // Release WebGL when permanently removed from the document (skip brief disconnect during moves)
    queueMicrotask(() => {
      if (!this.isConnected && this.map && !this._isFrozen) {
        void this.freeze().catch(() => {});
      }
    });

    // Don't call super.disconnectedCallback() because it resets this.map = null
    // We want to preserve the map instance for reuse in the map pool
    // Only clean up if we have a flag indicating permanent removal
    // For now, we preserve the map instance - it will be cleaned up
    // when the element is actually removed from the DOM permanently
    // (which doesn't happen in map pool reuse scenarios)
  }

  async initializeMap(): Promise<void> {
    // Prevent concurrent initialization
    if (this._isInitializing) {
      debug.warn('[gk-map] Already initializing, skipping duplicate call');
      return;
    }

    // Reuse a live map — creating another instance leaks WebGL contexts
    if (this.map && this.isInitialized && !this._isFrozen) {
      return;
    }

    // Tear down any stale/partial map before acquiring the init lock
    if (this.map) {
      await this.teardownMapInstance({ markFrozen: false });
    }

    this._isInitializing = true;
    debug.log('[gk-map] initializeMap start', {
      _isFrozen: this._isFrozen,
      hasMap: !!this.map,
      isInitialized: this.isInitialized,
    });

    try {
      // Get provider name from attribute or try auto-detection
      const providerName = this.getAttribute('provider');
      const apiKey = this.getAttribute('api-key');
      const accessToken = this.getAttribute('access-token');

      let provider;

      // If provider is explicitly specified, use it
      if (providerName) {
        const existingProvider = await getProviderByName(providerName).catch(() => null);

        // Load CSS for the provider (skip if already loaded via preload)
        if (providerName === 'maptiler') {
          if (!isMaplibreLayoutCssLoaded()) {
            await import('@maptiler/sdk/dist/maptiler-sdk.css');
          }
        } else if (providerName === 'mapbox') {
          const hasMapboxCss = Array.from(document.styleSheets).some((sheet) =>
            sheet.href?.includes('mapbox-gl')
          );
          if (!hasMapboxCss) {
            await import('mapbox-gl/dist/mapbox-gl.css');
          }
        }

        if (!existingProvider) {
          // Provider not registered, register and initialize it
          if (providerName === 'maptiler') {
            if (!getUIProviderByName('maptiler')) {
              registerUIProvider('maptiler', new MapTilerUIProvider());
            }
            // Only pass config if explicitly provided via attributes
            provider = await getProviderByName('maptiler', apiKey ? { apiKey } : undefined);
          } else if (providerName === 'mapbox') {
            const { MapboxUIProvider } = await import('../../../providers/mapbox-provider');
            registerUIProvider('mapbox', new MapboxUIProvider());
            // Only pass config if explicitly provided via attributes
            // Access env var - Vite will replace import.meta.env at build time
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - import.meta is available in ESNext modules
            const token = accessToken || import.meta.env?.MAPBOX_TOKEN;
            provider = await getProviderByName(
              'mapbox',
              token ? { accessToken: token } : undefined
            );
          } else {
            throw new Error(`Unknown provider: ${providerName}. Supported: maptiler, mapbox`);
          }
        } else {
          // Initialize existing provider with config (if provided)
          let config: { accessToken?: string } | { apiKey?: string } | undefined = undefined;
          if (providerName === 'mapbox') {
            // Access env var - Vite will replace import.meta.env at build time
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - import.meta is available in ESNext modules
            const token = accessToken || import.meta.env?.MAPBOX_TOKEN;
            if (token) config = { accessToken: token };
          } else if (apiKey) {
            config = { apiKey };
          }
          provider = await getProviderByName(providerName, config);
        }
      } else {
        // Auto-initialize MapTiler provider if api-key is present
        try {
          provider = this.getUIProvider(); // Check if default provider exists
        } catch {
          // No provider set, auto-initialize MapTiler if we have an API key
          if (apiKey) {
            debug.warn('[geokit] Auto-initializing MapTiler provider from api-key attribute');
            if (!getUIProviderByName('maptiler')) {
              registerUIProvider('maptiler', new MapTilerUIProvider());
            }
            provider = await getProviderByName('maptiler', { apiKey });
          } else {
            throw new Error(
              'No UI provider set. Add provider="maptiler" or provider="mapbox" attribute, or provide api-key for auto MapTiler initialization'
            );
          }
        }
      }

      const container = this as HTMLElement;

      if (!container) {
        throw new Error('Map container not found');
      }

      // Get map style: explicit theme > map-style attribute > system theme
      // DO NOT use 'style' attribute - that's for CSS, not map tiles!
      const themeAttr = this.getAttribute('theme');
      const mapStyleAttr = this.getAttribute('map-style');
      let styleAttr: string;

      if (themeAttr && isValidTheme(themeAttr)) {
        // Use explicit theme's map style
        this._currentTheme = getTheme(themeAttr);
        styleAttr = this._currentTheme.mapStyle;
        this._usingSystemTheme = false;
      } else if (mapStyleAttr) {
        // Use explicit map-style attribute
        styleAttr = mapStyleAttr;
        this._usingSystemTheme = false;
      } else {
        // No explicit theme or style - use system theme and listen for changes
        const systemThemeName = getSystemTheme();
        this._currentTheme = getTheme(systemThemeName);
        styleAttr = this._currentTheme.mapStyle;
        this._usingSystemTheme = true;
        this.setupSystemThemeListener();
      }

      // Parse max-pitch attribute (default 60 prevents disorienting "upside down" tilting)
      const maxPitchAttr = this.getAttribute('max-pitch');
      const maxPitch = maxPitchAttr ? parseFloat(maxPitchAttr) : undefined;

      // Parse min-zoom and max-zoom attributes (prevent zooming out/in too far)
      const minZoomAttr = this.getAttribute('min-zoom');
      const minZoom = minZoomAttr ? parseFloat(minZoomAttr) : undefined;
      const maxZoomAttr = this.getAttribute('max-zoom');
      const maxZoom = maxZoomAttr ? parseFloat(maxZoomAttr) : undefined;

      // Check for URL hash state if sync-url is enabled
      const urlState = this.hasAttribute('sync-url') ? this.parseUrlHashState() : null;

      const options = {
        lat: urlState?.lat ?? parseFloat(this.getAttribute('lat') || '0'),
        lng: urlState?.lng ?? parseFloat(this.getAttribute('lng') || '0'),
        zoom: urlState?.zoom ?? parseFloat(this.getAttribute('zoom') || '2'),
        minZoom,
        maxZoom,
        pitch: urlState?.pitch ?? parseFloat(this.getAttribute('pitch') || '0'),
        maxPitch,
        bearing: urlState?.bearing ?? parseFloat(this.getAttribute('bearing') || '0'),
        style: styleAttr,
        interactive: this.getAttribute('interactive') !== 'false',
      };

      // Create map; if browser is at WebGL context limit, createMap may throw
      try {
        this.map = await provider.createMap(container, options);
      } catch (err) {
        debug.warn('[gk-map] Map creation failed (e.g. too many WebGL contexts):', err);
        this.showPlaceholder('Loading map...');
        this.isInitialized = false;
        this._isInitializing = false;
        return;
      }

      // Wrap queryRenderedFeatures so MapTiler SDK internal calls (e.g. mousemove) don't throw
      // "unknown feature value" when parsing vector tiles in Safari
      if (this.map?.queryRenderedFeatures) {
        const original = this.map.queryRenderedFeatures.bind(this.map);
        this.map.queryRenderedFeatures = (
          point: { x: number; y: number },
          options?: { layers?: string[] }
        ) => {
          try {
            return original(point, options);
          } catch {
            return [];
          }
        };
      }

      // Wrap setFeatureState/removeFeatureState so MapTiler SDK "unknown feature value" during
      // coalesceChanges/render (sync or async) doesn't surface as uncaught
      const mapAny = this.map as {
        setFeatureState?: (
          state: { source: string; id: string | number },
          props: Record<string, unknown>
        ) => void;
        removeFeatureState?: (state: { source: string; id: string | number }) => void;
      };
      if (mapAny.setFeatureState) {
        const originalSet = mapAny.setFeatureState.bind(this.map);
        mapAny.setFeatureState = (state, props) => {
          try {
            originalSet(state, props);
          } catch {
            // MapTiler can throw "unknown feature value" when touching feature-state
          }
        };
      }
      if (mapAny.removeFeatureState) {
        const originalRemove = mapAny.removeFeatureState.bind(this.map);
        mapAny.removeFeatureState = (state) => {
          try {
            originalRemove(state);
          } catch {
            // MapTiler can throw "unknown feature value" when touching feature-state
          }
        };
      }

      // Wrap project() to catch DEM elevation errors when terrain is enabled
      // MapTiler SDK throws "out of range source coordinates for DEM data" when projecting
      // coordinates outside the terrain tile coverage (e.g. oceans, polar regions)
      const mapForProject = this.map as {
        project?: (lngLat: { lng: number; lat: number }) => { x: number; y: number };
      };
      if (mapForProject.project) {
        const originalProject = mapForProject.project.bind(this.map);
        mapForProject.project = (lngLat: { lng: number; lat: number }) => {
          try {
            return originalProject(lngLat);
          } catch {
            // Fallback: return center of viewport when DEM lookup fails
            const canvas = (
              this.map as { getCanvas?: () => HTMLCanvasElement | null }
            )?.getCanvas?.();
            return { x: (canvas?.width ?? 0) / 2, y: (canvas?.height ?? 0) / 2 };
          }
        };
      }

      // Suppress MapTiler errors thrown asynchronously (e.g. during coalesceChanges/render)
      // - "unknown feature value" when parsing vector tiles in Safari
      // - "out of range source coordinates for DEM data" when terrain elevation lookup fails
      // Use capture phase so we run before other handlers; match message only (stack may be minified/absent)
      this._maptilerErrorHandler = (event: ErrorEvent) => {
        const msg =
          event.message ??
          (event.error && typeof event.error === 'object' && 'message' in event.error
            ? String((event.error as Error).message)
            : '');
        if (
          typeof msg === 'string' &&
          (msg.includes('unknown feature value') ||
            msg.includes('out of range source coordinates for DEM'))
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      };
      window.addEventListener('error', this._maptilerErrorHandler, true);

      // Store reference to canvas for freeze/unfreeze
      if (this.map) {
        const mapContainer = (this.map as any).getContainer?.();
        if (mapContainer) {
          this._mapCanvas = mapContainer.querySelector('canvas');
        }
      }

      // Provide placeholder for missing style images (e.g. empty/whitespace IDs from MapTiler styles) to avoid console noise
      this.setupStyleImageMissingHandler();

      // Ensure map has a valid, non-deprecated style after creation
      // This handles cases where the SDK might default to deprecated styles
      // Wait for style to load before trying to set it
      this.ensureValidMapStyleAfterLoad();

      // Check if map is already loaded (style might load synchronously or very fast)
      // Use try-catch because isStyleLoaded may access properties that don't exist yet
      let styleAlreadyLoaded = false;
      try {
        const isStyleLoaded = (this.map as { isStyleLoaded?: () => boolean }).isStyleLoaded;
        if (isStyleLoaded && this.map) {
          styleAlreadyLoaded = isStyleLoaded.call(this.map);
        }
      } catch {
        // Map not ready yet, will wait for load event
        styleAlreadyLoaded = false;
      }

      // Set up features based on attributes
      this.setupHideAttribution();
      this.injectControlThemeStyles();

      // Optimize: Dispatch map-ready immediately when style is loaded
      // Don't wait for 'idle' - it can delay by hundreds of ms
      // Non-critical setup (controls, URL sync) is deferred to avoid blocking
      const dispatchMapReady = () => {
        if (this.isInitialized) return;
        debug.log('[gk-map] dispatchMapReady (hiding placeholder)', {
          _isFrozen: this._isFrozen,
          source: styleAlreadyLoaded ? 'styleAlreadyLoaded' : 'load-or-fallback',
        });
        this.isInitialized = true;
        this.hidePlaceholder();

        // MapLibre/MapTiler: 'idle' = no pending tile loads or renders (map fully painted)
        const mapAny = this.map as { once?: (e: string, fn: () => void) => void };
        if (mapAny?.once) {
          mapAny.once('idle', () => {
            this.hasPainted = true;
          });
        } else {
          this.hasPainted = true;
        }

        // Dispatch map-ready immediately so layers can be added
        this.dispatchEvent(
          new CustomEvent('gk-map-ready', {
            detail: { map: this.map, element: this },
            bubbles: true,
          })
        );

        // 3D terrain / hillshade are opt-in via attributes (default off)
        if (this.isMapOverlayEnabled('terrain-enabled') && this.getAttribute('terrain-min-zoom')) {
          this.setupTerrain();
        } else {
          this.cleanupTerrain();
        }

        // 3D buildings: enable when zoom >= buildings-min-zoom (if set)
        this.setup3DBuildings();

        if (this.isMapOverlayEnabled('hillshade-enabled')) {
          this.setupHillshade();
        } else {
          this.cleanupHillshade();
        }

        // Defer non-critical setup to avoid blocking first paint
        const deferredSetup = () => {
          this.setupAutoHideControls();
          this.setupBearingClamp();
          this.setupUrlSync();
        };

        requestIdleCallback(deferredSetup, { timeout: 200 });
      };

      // MapTiler SDK (MapLibre) events: 'load' = style loaded; 'idle' = no pending renders (tiles painted)
      if (styleAlreadyLoaded) {
        debug.log('[gk-map] style already loaded, dispatching map-ready immediately');
        dispatchMapReady();
      } else {
        if (this.map) {
          debug.log('[gk-map] waiting for map load event (and 5s fallback)');
          this.map.once('load', () => dispatchMapReady());
          // Fallback: if 'load' never fires but style has loaded (e.g. pool/managed timing), unblock placeholder
          const fallbackMs = 500;
          const fallbackMax = 10; // 5s total (style load or show "Map unavailable")
          let fallbackCount = 0;
          const fallbackId = window.setInterval(() => {
            fallbackCount += 1;
            const map = this.map as { isStyleLoaded?: () => boolean } | undefined;
            if (typeof map?.isStyleLoaded === 'function' && map.isStyleLoaded()) {
              window.clearInterval(fallbackId);
              debug.log('[gk-map] fallback: style loaded, dispatching map-ready', {
                check: fallbackCount,
              });
              dispatchMapReady();
              return;
            }
            if (fallbackCount >= fallbackMax) {
              window.clearInterval(fallbackId);
              const mapContainer = (
                this.map as { getContainer?: () => HTMLElement | null } | undefined
              )?.getContainer?.();
              const hasCanvas = Boolean(mapContainer?.querySelector?.('canvas'));
              if (hasCanvas) {
                debug.log('[gk-map] fallback: canvas painted, dispatching map-ready', {
                  check: fallbackCount,
                });
                dispatchMapReady();
                return;
              }
              debug.log('[gk-map] fallback: style never loaded after 5s, will retry', {
                _isFrozen: this._isFrozen,
              });
              // Style never loaded - keep showing "Loading map..." and let pool retry
              this.showPlaceholder('Loading map...');
              this.isInitialized = false;
              return;
            }
          }, fallbackMs);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isWebGLContextLost = /losecontext|context already lost|invalid_operation/i.test(
        message
      );
      if (isWebGLContextLost) {
        debug.warn('[gk-map] WebGL context unavailable (e.g. too many maps):', message);
      } else {
        console.error('[gk-map] Failed to initialize map:', error);
      }
      this.showPlaceholder('Loading map...');
      this.isInitialized = false;
      this.dispatchEvent(
        new CustomEvent('gk-map-failed', { detail: { element: this, error }, bubbles: true })
      );
    } finally {
      this._isInitializing = false;
    }
  }

  private ensureValidMapStyleAfterLoad(): void {
    if (!this.map) return;
    const apiKey = this.getAttribute('api-key') || '';
    ensureValidMapStyleAfterLoadFn(this.map as any, apiKey, () =>
      checkAndUpdateStyleFn(this.map as any, apiKey)
    );
  }

  private checkAndUpdateStyle(): void {
    if (!this.map) return;
    checkAndUpdateStyleFn(this.map as any, this.getAttribute('api-key') || '');
  }

  private setupStyleImageMissingHandler(): void {
    const map = this.map as any;
    const handler = createStyleImageMissingHandler(map);
    if (!handler) return;
    this._styleImageMissingHandler = handler;
    map.on('styleimagemissing', handler);
  }

  /**
   * Show placeholder if map is not initialized
   * The placeholder is a child of the gk-map element itself
   */
  private showPlaceholderIfNeeded(): void {
    // Don't show placeholder if map is already initialized
    if (this.isInitialized || this.map) {
      return;
    }
    this.showPlaceholder();
  }

  /**
   * Show placeholder (public method for map collection).
   * Uses attribute `placeholder-message` when no message is passed (e.g. "Loading map..." when data was prefetched).
   */
  public showPlaceholder(message?: string): void {
    const text = message ?? this.getAttribute('placeholder-message') ?? 'Loading map...';
    debug.log('[gk-map] showPlaceholder', {
      message: text,
      _isFrozen: this._isFrozen,
      isInitialized: this.isInitialized,
    });

    // Show spinner for loading/restoring states
    const showSpinner = text === 'Loading map...' || text === 'Restoring...';

    const selector = getPlaceholderSelector();
    const existingPlaceholder = this.querySelector(selector) as HTMLElement | null;

    if (existingPlaceholder) {
      const existingText = existingPlaceholder.getAttribute('data-message');
      if (existingText !== text) {
        existingPlaceholder.setAttribute('data-message', text);
        existingPlaceholder.innerHTML = createPlaceholderContentFn(text, showSpinner);
        this._startStuckCheckIfLoading(text);
      }
      return;
    }

    const placeholder = document.createElement('div');
    placeholder.className = 'map-placeholder';
    placeholder.setAttribute('data-map-placeholder', 'true');
    placeholder.setAttribute('data-message', text);
    placeholder.style.cssText = MAP_PLACEHOLDER_STYLE;
    placeholder.innerHTML = createPlaceholderContentFn(text, showSpinner);
    this.appendChild(placeholder);
    this._startStuckCheckIfLoading(text);
  }

  /** Start one-shot stuck timer when showing Loading map.../Restoring...; cleared when placeholder hides or map ready */
  private _startStuckCheckIfLoading(message: string): void {
    if (message !== 'Loading map...' && message !== 'Restoring...') return;
    this._clearStuckCheck();
    this._stuckCheckTimer = setTimeout(() => {
      this._stuckCheckTimer = null;
      if (this.isInitialized || !this.hasPlaceholder()) return;
      debug.log('[gk-map] stuck: placeholder still visible after timeout', { message });
      this.isInitialized = false;
      this.showPlaceholder('Loading map...');
      this.dispatchEvent(
        new CustomEvent('gk-map-stuck', { detail: { element: this }, bubbles: true })
      );
    }, STUCK_MS);
  }

  private _clearStuckCheck(): void {
    if (this._stuckCheckTimer !== null) {
      clearTimeout(this._stuckCheckTimer);
      this._stuckCheckTimer = null;
    }
  }

  /**
   * Hide placeholder when map is ready (public method for map collection)
   */
  public hidePlaceholder(): void {
    const hadPlaceholder = this.hasPlaceholder();
    if (hadPlaceholder) {
      debug.log('[gk-map] hidePlaceholder', { isInitialized: this.isInitialized });
    }
    this._clearStuckCheck();
    const selector = getPlaceholderSelector();
    this.querySelectorAll(selector).forEach((placeholder) => placeholder.remove());
  }

  /**
   * Check if map has a placeholder
   */
  public hasPlaceholder(): boolean {
    return !!this.querySelector(getPlaceholderSelector());
  }

  /**
   * Placeholder message (for collection status/health checks). Returns '' if no placeholder.
   */
  public getPlaceholderMessage(): string {
    const el = this.querySelector(getPlaceholderSelector());
    return (el?.getAttribute?.('data-message') ?? (el?.textContent ?? '').trim()) || '';
  }

  /**
   * Set up hide attribution behavior
   * Attribution is hidden by default unless `show-attribution` is present
   */
  private setupHideAttribution(): void {
    if (this.hasAttribute('show-attribution')) return;
    injectHideAttributionStylesFn();
    this.classList.add('gk-hide-attribution');
  }

  /**
   * Sync theme class to element: gk-theme-light or gk-theme-dark when theme attr set;
   * otherwise none (default comes from injected :root + @media (prefers-color-scheme: dark)).
   */
  private syncThemeClass(): void {
    this.classList.remove('gk-theme-light', 'gk-theme-dark');
    const themeAttr = this.getAttribute('theme');
    if (themeAttr && isValidTheme(themeAttr)) {
      this.classList.add('gk-theme-' + themeAttr);
    } else if (this._usingSystemTheme) {
      // When using system theme, also sync the class for CSS variables
      this.classList.add('gk-theme-' + this._currentTheme.name);
    }
  }

  /**
   * Set up listener for system theme changes (prefers-color-scheme).
   * Only active when no explicit theme attribute is set.
   */
  private setupSystemThemeListener(): void {
    this.cleanupSystemThemeListener();

    this._systemThemeMediaQuery = getSystemThemeMediaQuery();
    if (!this._systemThemeMediaQuery) return;

    this._systemThemeHandler = (e: MediaQueryListEvent) => {
      // Only respond if we're still using system theme (no explicit theme attribute)
      if (!this._usingSystemTheme) return;

      const newThemeName: ThemeName = e.matches ? 'dark' : 'light';
      debug.log('[gk-map] System theme changed to', newThemeName);

      this._currentTheme = getTheme(newThemeName);
      this.syncThemeClass();

      // Update map tiles if map is initialized
      if (this.map) {
        this.updateMapStyle(this._currentTheme.mapStyle);
      }

      // Dispatch theme change event
      this.dispatchEvent(
        new CustomEvent('themechange', {
          detail: { theme: this._currentTheme, themeName: newThemeName, source: 'system' },
          bubbles: true,
        })
      );
    };

    this._systemThemeMediaQuery.addEventListener('change', this._systemThemeHandler);
  }

  /**
   * Clean up system theme listener.
   */
  private cleanupSystemThemeListener(): void {
    if (this._systemThemeMediaQuery && this._systemThemeHandler) {
      this._systemThemeMediaQuery.removeEventListener('change', this._systemThemeHandler);
    }
    this._systemThemeMediaQuery = null;
    this._systemThemeHandler = null;
  }

  /**
   * Inject CSS for theme-aware controls (once per document).
   * Injected stylesheet includes :root + @media (prefers-color-scheme: dark) and
   * gk-map.gk-theme-light / gk-map.gk-theme-dark; theme class syncs to element when theme attr set.
   */
  private injectControlThemeStyles(): void {
    injectThemeStyles();
    const themeAttr = this.getAttribute('theme');
    if (themeAttr && isValidTheme(themeAttr)) {
      this._currentTheme = getTheme(themeAttr);
      this.syncThemeClass();
    }
  }

  /**
   * Set up auto-hide controls behavior
   * When enabled, controls are hidden until the user hovers/focuses the map
   */
  private setupAutoHideControls(): void {
    if (!this.hasAttribute('auto-hide-controls')) return;

    injectAutoHideStylesFn();

    // Initially hide controls via class
    this.classList.add('gk-controls-hidden');
    this._controlsVisible = false;

    // Show controls on mouse enter
    this._mouseEnterHandler = () => this.setControlsVisible(true);
    this._mouseLeaveHandler = () => this.setControlsVisible(false);

    this.addEventListener('mouseenter', this._mouseEnterHandler);
    this.addEventListener('mouseleave', this._mouseLeaveHandler);
  }

  /**
   * Clean up auto-hide event listeners
   */
  private cleanupAutoHideControls(): void {
    if (this._mouseEnterHandler) {
      this.removeEventListener('mouseenter', this._mouseEnterHandler);
      this._mouseEnterHandler = null;
    }
    if (this._mouseLeaveHandler) {
      this.removeEventListener('mouseleave', this._mouseLeaveHandler);
      this._mouseLeaveHandler = null;
    }
  }

  // ============================================================================
  // URL Hash Sync
  // ============================================================================

  private parseUrlHashState(): ReturnType<typeof parseUrlHashStateFn> {
    return parseUrlHashStateFn();
  }

  /**
   * Update URL hash with current map state
   * Uses debouncing to avoid excessive URL updates during panning
   */
  private updateUrlHash(): void {
    if (!this.map || !this._urlSyncEnabled || this._isUpdatingFromUrl) {
      return;
    }

    // Clear existing debounce timer
    if (this._urlSyncDebounceTimer) {
      clearTimeout(this._urlSyncDebounceTimer);
    }

    // Debounce URL updates (150ms)
    this._urlSyncDebounceTimer = setTimeout(() => {
      if (!this.map) return;
      const map = this.map as any;
      const center = map.getCenter?.();
      const zoom = map.getZoom?.();
      const pitch = map.getPitch?.();
      const bearing = map.getBearing?.();
      if (!center || zoom === undefined) return;
      const state = {
        zoom,
        lat: center.lat,
        lng: center.lng,
        pitch: pitch ?? 0,
        bearing: bearing ?? 0,
      };
      const hashString = buildHashFromState(state);
      const currentUrl = new URL(window.location.href);
      if (currentUrl.hash !== hashString) {
        history.replaceState(history.state, '', hashString);
      }
    }, 150);
  }

  private applyUrlHashState(): void {
    const state = parseUrlHashStateFn();
    if (!state || !this.map) return;
    this._isUpdatingFromUrl = true;
    try {
      applyStateToMap(
        this.map as {
          jumpTo?(opts: {
            center: [number, number];
            zoom: number;
            pitch?: number;
            bearing?: number;
          }): void;
        },
        state
      );
    } finally {
      setTimeout(() => {
        this._isUpdatingFromUrl = false;
      }, 100);
    }
  }

  /**
   * Clamp bearing on moveend so the map stays mostly upright (e.g. ±30°).
   * Parses max-bearing attribute (default 30); set to 0 to disable.
   * Parses bearing-clamp-max-zoom attribute; above this zoom, clamping is disabled
   * (allowing free rotation at street level).
   */
  private setupBearingClamp(): void {
    const maxBearingAttr = this.getAttribute('max-bearing');
    // Default 30° keeps map mostly upright; set to "0" to disable clamping
    const maxBearing =
      maxBearingAttr === null || maxBearingAttr === '' ? 30 : parseFloat(maxBearingAttr);
    if (!Number.isFinite(maxBearing) || maxBearing <= 0) return;

    const map = this.map as {
      getBearing?: () => number;
      setBearing?: (b: number) => void;
      getZoom?: () => number;
    };
    if (!map?.getBearing || !map?.setBearing) return;

    // Parse bearing-clamp-max-zoom: above this zoom, allow free rotation (street level)
    const maxZoomAttr = this.getAttribute('bearing-clamp-max-zoom');
    const bearingClampMaxZoom = maxZoomAttr ? parseFloat(maxZoomAttr) : Infinity;

    this._bearingClampHandler = () => {
      // Skip clamping at street level (high zoom)
      if (map.getZoom && map.getZoom() >= bearingClampMaxZoom) return;

      const b = map.getBearing!();
      // Normalize to -180..180 so we clamp to the "closest to north" range
      const normalized = ((b + 180) % 360) - 180;
      if (Math.abs(normalized) <= maxBearing) return;
      const clamped = normalized > 0 ? maxBearing : -maxBearing;
      map.setBearing!(clamped);
    };

    this.map!.on('moveend', this._bearingClampHandler);
  }

  private cleanupBearingClamp(): void {
    if (this._bearingClampHandler && this.map) {
      this.map.off('moveend', this._bearingClampHandler);
      this._bearingClampHandler = null;
    }
  }

  /**
   * Set up URL hash synchronization
   * Called when map is ready and sync-url attribute is present
   */
  private setupUrlSync(): void {
    if (!this.hasAttribute('sync-url') || this._urlSyncEnabled) {
      return;
    }

    this._urlSyncEnabled = true;

    // Apply URL state if present (may have already been applied during init)
    // This handles cases where URL was changed while map was loading
    this.applyUrlHashState();

    // Listen for map movement to update URL
    this._mapMoveEndHandler = () => this.updateUrlHash();
    if (this.map) {
      this.map.on('moveend', this._mapMoveEndHandler);
    }

    // Listen for URL hash changes (e.g., browser back/forward)
    this._hashChangeHandler = () => {
      if (this._isUpdatingFromUrl) return;
      this.applyUrlHashState();
    };
    window.addEventListener('hashchange', this._hashChangeHandler);
  }

  /**
   * Remove all listeners from the map instance so no handler runs after map.remove().
   * Call before map.remove() in _freeze to avoid getLayer/queryRenderedFeatures on a destroyed map.
   */
  private removeAllMapListeners(): void {
    this.cleanupBearingClamp();
    this.cleanupUrlSync();
    this.cleanupTerrain();
    this.cleanup3DBuildings();
    this.cleanupHillshade();
    const map = this.map as any;
    if (!map?.off) return;
    if (this._styleImageMissingHandler) {
      map.off('styleimagemissing', this._styleImageMissingHandler);
      this._styleImageMissingHandler = null;
    }
    map.off('style.load');
    map.off('error');
  }

  /** True when a boolean map overlay attribute is enabled (present and not "false"/"0"). */
  private isMapOverlayEnabled(name: string): boolean {
    if (!this.hasAttribute(name)) return false;
    const value = this.getAttribute(name);
    return value !== 'false' && value !== '0';
  }

  private setupTerrain(): void {
    this._terrainZoomHandler = createTerrainZoomHandler({
      getAttribute: (n) => this.getAttribute(n),
      map: this.map,
    });
  }

  private cleanupTerrain(): void {
    cleanupTerrainFn(this.map, this._terrainZoomHandler);
    this._terrainZoomHandler = null;
  }

  private setup3DBuildings(): void {
    this._buildingsZoomHandler = createBuildingsZoomHandler({
      getAttribute: (n) => this.getAttribute(n),
      map: this.map,
    });
  }

  private cleanup3DBuildings(): void {
    cleanup3DBuildingsFn(this.map, this._buildingsZoomHandler);
    this._buildingsZoomHandler = null;
  }

  private setupHillshade(): void {
    this._hillshadeUpdateHandler = setupHillshadeFn({
      getAttribute: (n) => this.getAttribute(n),
      map: this.map,
    });
  }

  private cleanupHillshade(): void {
    cleanupHillshadeFn(this.map);
    this._hillshadeUpdateHandler = null;
  }

  /**
   * Clean up URL hash synchronization
   */
  private cleanupUrlSync(): void {
    if (this._urlSyncDebounceTimer) {
      clearTimeout(this._urlSyncDebounceTimer);
      this._urlSyncDebounceTimer = null;
    }

    if (this._mapMoveEndHandler && this.map) {
      this.map.off('moveend', this._mapMoveEndHandler);
      this._mapMoveEndHandler = null;
    }

    if (this._hashChangeHandler) {
      window.removeEventListener('hashchange', this._hashChangeHandler);
      this._hashChangeHandler = null;
    }

    this._urlSyncEnabled = false;
  }

  /**
   * Show or hide map controls
   * Works with SDK controls added via addControl()
   * @param visible - Whether controls should be visible
   */
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
          this.updateMapStyle(this._currentTheme.mapStyle);
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
          this.updateMapStyle(this._currentTheme.mapStyle);
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
        this.updateCenter();
        break;
      case 'zoom':
        if (newValue) {
          const setZoom = (this.map as { setZoom?: (zoom: number) => void }).setZoom;
          if (setZoom) {
            setZoom(parseFloat(newValue));
          }
        }
        break;
      case 'pitch':
        if (newValue) {
          const setPitch = (this.map as { setPitch?: (pitch: number) => void }).setPitch;
          if (setPitch) {
            setPitch(parseFloat(newValue));
          }
        }
        break;
      case 'bearing':
        if (newValue) {
          const setBearing = (this.map as { setBearing?: (bearing: number) => void }).setBearing;
          if (setBearing) {
            setBearing(parseFloat(newValue));
          }
        }
        break;
    }
  }

  private updateCenter(): void {
    if (!this.map) return;

    const lat = parseFloat(this.getAttribute('lat') || '0');
    const lng = parseFloat(this.getAttribute('lng') || '0');

    const setCenter = (this.map as { setCenter?: (center: [number, number]) => void }).setCenter;
    if (setCenter) {
      setCenter([lng, lat]);
    }
  }

  // Public API
  public getMap(): MapInstance | null {
    return this.map;
  }

  /**
   * Embed scale for shared point layers (1 = full size).
   * Enabled with `compact-points` or explicit `point-scale="0.5"`.
   */
  public getEmbedPointScale(): number {
    const pointScaleAttr = this.getAttribute('point-scale');
    if (pointScaleAttr) {
      const explicit = parseFloat(pointScaleAttr);
      if (Number.isFinite(explicit) && explicit > 0) {
        return resolveEmbedPointScale({ embedPointScale: explicit });
      }
    }

    const compactAttr = this.getAttribute('compact-points');
    const compactPoints = compactAttr !== null && compactAttr !== 'false';
    if (!compactPoints) return 1;

    return resolveEmbedPointScale({
      map: this.map,
      container: this,
      compactPoints: true,
    });
  }

  public setCenter(lat: number, lng: number): void {
    this.setAttribute('lat', lat.toString());
    this.setAttribute('lng', lng.toString());
  }

  public setZoom(zoom: number): void {
    this.setAttribute('zoom', zoom.toString());
  }

  public flyTo(lat: number, lng: number, zoom?: number): void {
    if (!this.map) return;

    const map = this.map as {
      flyTo?: (options: { center: [number, number]; zoom: number }) => void;
      getZoom?: () => number;
      loaded?: () => boolean;
    };

    if (!map.flyTo) return;
    if (typeof map.loaded === 'function' && !map.loaded()) return;

    const targetZoom = zoom !== undefined ? zoom : (map.getZoom?.() ?? 10);
    map.flyTo({
      center: [lng, lat],
      zoom: targetZoom,
    });
  }

  // ============================================================================
  // Theme Management
  // ============================================================================

  /**
   * Get the current theme
   */
  public getTheme(): Theme {
    return this._currentTheme;
  }

  /**
   * Get the current theme name
   */
  public getThemeName(): ThemeName {
    return this._currentTheme.name;
  }

  /**
   * Set the theme by name
   * Updates both the map style and control styling
   */
  public setTheme(themeName: ThemeName): void {
    this.setAttribute('theme', themeName);
  }

  /**
   * Toggle between light and dark themes
   */
  public toggleTheme(): ThemeName {
    const newTheme = this._currentTheme.name === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
    return newTheme;
  }

  /**
   * Apply a theme to the map (class-based; map style and event updated)
   */
  private applyTheme(themeName: ThemeName): void {
    const theme = getTheme(themeName);
    this._currentTheme = theme;
    this.setAttribute('theme', themeName);
    this.syncThemeClass();
    debug.log('[gk-map] applyTheme', {
      themeName,
      mapStyle: theme.mapStyle,
      hasMap: !!this.map,
      isInitialized: this.isInitialized,
    });

    if (this.map && this.isInitialized) {
      this.updateMapStyle(theme.mapStyle);
    }

    this.dispatchEvent(
      new CustomEvent('gk-theme-change', {
        detail: { theme, themeName },
        bubbles: true,
      })
    );
  }

  /**
   * Temporarily filter the MapTiler SDK "distant style could not be loaded" message from console.
   * The SDK logs this in its own error handler when a style URL fails to load; we cannot prevent it.
   * Restore is scheduled after 1s and also runs on teardown (_freeze).
   */
  private _installStyleLoadConsoleFilter(): void {
    if (this._styleLoadConsoleRestoreTimeout) {
      clearTimeout(this._styleLoadConsoleRestoreTimeout);
      this._styleLoadConsoleRestoreTimeout = null;
      if (this._styleLoadOriginalWarn) {
        console.warn = this._styleLoadOriginalWarn;
        this._styleLoadOriginalWarn = null;
      }
      if (this._styleLoadOriginalError) {
        console.error = this._styleLoadOriginalError;
        this._styleLoadOriginalError = null;
      }
    }
    const originalWarn = console.warn;
    const originalError = console.error;
    this._styleLoadOriginalWarn = originalWarn;
    this._styleLoadOriginalError = originalError;
    const filter = (msg: string): boolean =>
      /distant\s+style\s+could\s+not\s+be\s+loaded/i.test(msg);
    console.warn = (...args: unknown[]) => {
      const msg = args.map((a) => String(a)).join(' ');
      if (filter(msg)) return;
      originalWarn.apply(console, args);
    };
    console.error = (...args: unknown[]) => {
      const msg = args.map((a) => String(a)).join(' ');
      if (filter(msg)) return;
      originalError.apply(console, args);
    };
    this._styleLoadConsoleRestoreTimeout = setTimeout(() => {
      if (this._styleLoadOriginalWarn) {
        console.warn = this._styleLoadOriginalWarn;
        this._styleLoadOriginalWarn = null;
      }
      if (this._styleLoadOriginalError) {
        console.error = this._styleLoadOriginalError;
        this._styleLoadOriginalError = null;
      }
      this._styleLoadConsoleRestoreTimeout = null;
    }, 1000);
  }

  private _restoreStyleLoadConsole(): void {
    if (this._styleLoadConsoleRestoreTimeout) {
      clearTimeout(this._styleLoadConsoleRestoreTimeout);
      this._styleLoadConsoleRestoreTimeout = null;
    }
    if (this._styleLoadOriginalWarn) {
      console.warn = this._styleLoadOriginalWarn;
      this._styleLoadOriginalWarn = null;
    }
    if (this._styleLoadOriginalError) {
      console.error = this._styleLoadOriginalError;
      this._styleLoadOriginalError = null;
    }
  }

  /**
   * Update the map's base style for theme switching.
   * Uses the current UI provider's getStyleForTheme so both MapTiler and Mapbox support light/dark.
   *
   * If the style URL fails to load (e.g. invalid/missing API key, network error), the SDK logs
   * "The distant style could not be loaded. Leaving the style as is." and the map keeps the
   * previous style. Ensure MapTiler API key is set (e.g. gk-map api-key or provider config).
   */
  private updateMapStyle(styleName: string): void {
    if (!this.map) return;

    const map = this.map as any;
    if (typeof map.setStyle !== 'function') return;
    debug.log('[gk-map] updateMapStyle', { styleName });

    // MapTiler SDK logs "The distant style could not be loaded" in its own error handler; we cannot prevent it.
    // Temporarily filter that single message so the console stays clean when theme/style load fails.
    this._installStyleLoadConsoleFilter();

    const providerName = this.getAttribute('provider') || 'maptiler';
    const provider = getUIProviderByName(providerName);

    // Resolve style URL first. For MapTiler, getStyleForTheme returns null when no API key is configured;
    // calling setStyle without a valid key triggers "The distant style could not be loaded". Skip theme switch.
    if (provider?.getStyleForTheme) {
      const styleForTheme = provider.getStyleForTheme(styleName);
      if (styleForTheme == null) {
        if (providerName === 'maptiler') {
          debug.log(
            '[gk-map] updateMapStyle skipped: no MapTiler API key (set via configure() or api-key attribute)'
          );
          return;
        }
        // Other providers: no style for this theme name, fall through to fallbacks
      } else {
        try {
          debug.log('[gk-map] setStyle via provider getStyleForTheme', {
            provider: providerName,
            style: typeof styleForTheme === 'string' ? styleForTheme : '(object)',
          });
          // Register error/style.load handlers before setStyle so we catch load failures and do not dispatch re-add
          this._onStyleLoadReaddLayers();
          map.setStyle(styleForTheme);
          return;
        } catch (error) {
          console.warn('[gk-map] Failed to update map style:', error);
          return;
        }
      }
    }

    // Fallback: MapTiler-specific (e.g. when provider doesn't implement getStyleForTheme)
    const sdk = (window as any).maptilersdk;
    const apiKey = sdk?.config?.apiKey || this.getAttribute('api-key') || '';
    const normalized = styleName.toLowerCase();
    const themeStyleNames = ['dataviz', 'dataviz-dark', 'light', 'dark'];
    if (themeStyleNames.includes(normalized) && apiKey) {
      const mapName =
        normalized === 'light' ? 'dataviz' : normalized === 'dark' ? 'dataviz-dark' : normalized;
      const styleUrl = `https://api.maptiler.com/maps/${mapName}/style.json?key=${apiKey}`;
      try {
        this._onStyleLoadReaddLayers();
        map.setStyle(styleUrl);
        return;
      } catch (error) {
        console.warn('[gk-map] Failed to update map style:', error);
        return;
      }
    }

    if (sdk?.MapStyle) {
      const styleMap: Record<string, unknown> = {
        streets: sdk.MapStyle.STREETS?.DEFAULT,
        'streets-dark': sdk.MapStyle.STREETS?.DARK,
        satellite: sdk.MapStyle.SATELLITE?.DEFAULT,
        hybrid: sdk.MapStyle.HYBRID?.DEFAULT,
        outdoor: sdk.MapStyle.OUTDOOR?.DEFAULT,
        basic: sdk.MapStyle.BASIC?.DEFAULT,
      };
      const sdkStyle = styleMap[normalized];
      if (sdkStyle) {
        try {
          this._onStyleLoadReaddLayers();
          map.setStyle(sdkStyle);
          return;
        } catch (error) {
          console.warn('[gk-map] Failed to update map style via SDK:', error);
        }
      }
    }

    if (apiKey) {
      try {
        this._onStyleLoadReaddLayers();
        const styleUrl = `https://api.maptiler.com/maps/${normalized}/style.json?key=${apiKey}`;
        map.setStyle(styleUrl);
      } catch (error) {
        console.warn('[gk-map] Failed to update map style:', error);
      }
    }
  }

  /**
   * When map style is replaced (e.g. theme toggle), custom layers/sources are removed.
   * Listen for style.load only (not 'load' or 'idle') to avoid dispatching during initial load
   * or transitional state. Defers dispatch with double rAF and only dispatches when style is
   * ready to avoid "Cannot convert undefined or null to object" in MapTiler's coalesceChanges.
   */
  private _onStyleLoadReaddLayers(): void {
    if (!this.map) return;
    debug.log('[gk-map] _onStyleLoadReaddLayers: registering style.load + 500ms fallback');

    const map = this.map as {
      once?: (event: string, handler: (e?: { error?: { message?: string } }) => void) => void;
      on?: (event: string, handler: (e?: { error?: { message?: string } }) => void) => void;
      off?: (event: string, handler: (e?: { error?: { message?: string } }) => void) => void;
      isStyleLoaded?: () => boolean;
      getStyle?: () => { layers?: unknown[] } | null;
    };
    if (typeof map.on !== 'function') return;

    let dispatched = false;
    let scheduled = false;
    let styleLoadFailed = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const styleLoadHandler = () => {
      debug.log('[gk-map] style.load fired');
      dispatchReadd(false);
    };

    const errorHandler = (e?: unknown) => {
      const msg =
        (e &&
        typeof e === 'object' &&
        'error' in e &&
        e.error &&
        typeof (e.error as any).message === 'string'
          ? (e.error as { message: string }).message
          : e instanceof Error
            ? e.message
            : typeof e === 'string'
              ? e
              : '') || String(e ?? '');
      if (/style|could not be loaded|distant/i.test(msg)) {
        styleLoadFailed = true;
        debug.log('[gk-map] style load failed, will not dispatch gk-map-style-load', {
          message: msg,
        });
        cleanup();
      }
    };

    let cleanup = () => {
      if (map.off) {
        map.off('style.load', styleLoadHandler);
        map.off('error', errorHandler);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const isStyleReady = (): boolean => {
      if (!this.map) return false;
      const m = this.map as { isStyleLoaded?: () => boolean; getStyle?: () => unknown };
      if (typeof m.isStyleLoaded === 'function' && !m.isStyleLoaded()) return false;
      const style = typeof m.getStyle === 'function' ? m.getStyle() : null;
      return style != null;
    };

    const dispatchReadd = (fromTimeout: boolean = false) => {
      if (dispatched || scheduled || styleLoadFailed) {
        debug.log('[gk-map] dispatchReadd skipped', {
          fromTimeout,
          dispatched,
          scheduled,
          styleLoadFailed,
        });
        return;
      }
      scheduled = true;
      debug.log('[gk-map] dispatchReadd scheduled', { fromTimeout });
      // Double rAF so MapTiler's internal state is settled.
      // When fromTimeout: always dispatch so layers re-add even if style.load never fired (e.g. dark→light).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scheduled = false;
          if (dispatched || !this.map) return;
          const ready = isStyleReady();
          if (!fromTimeout && !ready) {
            debug.log('[gk-map] dispatchReadd: style not ready, skipping dispatch', {
              isStyleLoaded: (this.map as any)?.isStyleLoaded?.(),
            });
            return;
          }
          dispatched = true;
          cleanup();
          debug.log('[gk-map] dispatching gk-map-style-load', { fromTimeout, styleReady: ready });
          this.dispatchEvent(
            new CustomEvent('gk-map-style-load', {
              detail: { map: this.map, element: this },
              bubbles: true,
            })
          );
        });
      });
    };

    map.on('style.load', styleLoadHandler);
    map.on('error', errorHandler);
    // Fallback: if style.load never fires (e.g. some MapTiler style switches to light), poll until style is ready then dispatch.
    // Use 500ms so a failed style load (e.g. "distant style could not be loaded") has time to emit 'error' before we dispatch.
    const fallbackMs = 500;
    const pollMs = 50;
    const maxWaitMs = 2500;
    timeoutId = setTimeout(() => {
      if (dispatched) return;
      if (isStyleReady()) {
        dispatchReadd(true);
        return;
      }
      let elapsed = fallbackMs;
      const pollId = setInterval(() => {
        if (dispatched) {
          clearInterval(pollId);
          return;
        }
        if (isStyleReady() || elapsed >= maxWaitMs) {
          clearInterval(pollId);
          dispatchReadd(true);
          return;
        }
        elapsed += pollMs;
      }, pollMs);
      // Clear polling when style.load fires (cleanup clears timeoutId; interval remains until ready or max)
      const origCleanup = cleanup;
      cleanup = () => {
        clearInterval(pollId);
        origCleanup();
      };
    }, fallbackMs);
  }

  /**
   * Clear all child elements (points, polygons, etc.)
   * Used by map pool to reset maps when reassigning
   * Ensures proper cleanup by triggering disconnectedCallback on each child
   * Also cleans up any dangling layers/sources in the map
   */
  public clearChildren(): void {
    const map = this.getMap();

    // Remove all children except the ones in shadow DOM
    const children = Array.from(this.children);
    children.forEach((child) => {
      // Trigger cleanup before removing (disconnectedCallback handles layer/source cleanup)
      if (
        typeof (child as HTMLElement & { disconnectedCallback?: () => void })
          .disconnectedCallback === 'function'
      ) {
        try {
          (child as HTMLElement & { disconnectedCallback: () => void }).disconnectedCallback();
        } catch (error) {
          console.warn(`Error in disconnectedCallback for ${child.tagName}:`, error);
        }
      }
      // Remove the element from DOM
      child.remove();
    });

    // Clean up any dangling layers/sources that might not have been cleaned up
    if (map && map.getLayer && map.removeLayer && map.getSource && map.removeSource) {
      try {
        // Get all layers and remove custom ones
        const style = (
          map as { getStyle?: () => { layers?: Array<{ id?: string }> } }
        ).getStyle?.();
        if (style?.layers) {
          style.layers.forEach((layer) => {
            const layerId = layer.id;
            if (
              layerId &&
              (layerId.startsWith('point-') ||
                layerId.startsWith('polygon-') ||
                layerId.startsWith('polyline-') ||
                layerId.startsWith('marker-') ||
                layerId.startsWith('isochrone-'))
            ) {
              try {
                if (map.getLayer?.(layerId)) {
                  map.removeLayer?.(layerId);
                }
              } catch {
                // Layer might already be removed
              }
            }
          });
        }

        // Remove custom sources
        if (style && 'sources' in style && style.sources) {
          Object.keys(style.sources as Record<string, unknown>).forEach((sourceId) => {
            if (
              sourceId.startsWith('point-') ||
              sourceId.startsWith('polygon-') ||
              sourceId.startsWith('polyline-') ||
              sourceId.startsWith('marker-') ||
              sourceId.startsWith('isochrone-')
            ) {
              try {
                if (map.getSource?.(sourceId)) {
                  map.removeSource?.(sourceId);
                }
              } catch {
                // Source might already be removed
              }
            }
          });
        }
      } catch (error) {
        console.warn('Error cleaning up dangling layers/sources:', error);
      }
    }
  }

  /**
   * Get count of child elements by type
   * Used for debugging and verification
   */
  public getChildCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    const children = Array.from(this.children);

    children.forEach((child) => {
      const tagName = child.tagName.toLowerCase();
      counts[tagName] = (counts[tagName] || 0) + 1;
    });

    return counts;
  }

  // ============================================================================
  // Child Element Tracking
  // ============================================================================

  /**
   * Initialize MutationObserver to track child element additions/removals
   */
  private _initializeChildTracking(): void {
    if (this._childObserver) return; // Already initialized

    // Track existing children
    Array.from(this.children).forEach((child) => {
      this._trackChild(child as HTMLElement);
    });

    // Set up MutationObserver to track future additions/removals
    this._childObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this._trackChild(node as HTMLElement);
          }
        });
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this._untrackChild(node as HTMLElement);
          }
        });
      });
    });

    this._childObserver.observe(this, {
      childList: true,
      subtree: false, // Only direct children
    });
  }

  /**
   * Clean up child tracking observer
   */
  private _cleanupChildTracking(): void {
    if (this._childObserver) {
      this._childObserver.disconnect();
      this._childObserver = null;
    }
    this._trackedChildren.clear();
  }

  /**
   * Track a child element by its tag name
   */
  private _trackChild(element: HTMLElement): void {
    const tagName = element.tagName.toLowerCase();
    if (!this._trackedChildren.has(tagName)) {
      this._trackedChildren.set(tagName, new Set());
    }
    this._trackedChildren.get(tagName)!.add(element);

    // Dispatch event
    this.dispatchEvent(
      new CustomEvent('child-added', {
        detail: { element, tagName },
        bubbles: false,
      })
    );
  }

  /**
   * Untrack a child element
   */
  private _untrackChild(element: HTMLElement): void {
    const tagName = element.tagName.toLowerCase();
    const set = this._trackedChildren.get(tagName);
    if (set) {
      set.delete(element);
      if (set.size === 0) {
        this._trackedChildren.delete(tagName);
      }
    }

    // Dispatch event
    this.dispatchEvent(
      new CustomEvent('child-removed', {
        detail: { element, tagName },
        bubbles: false,
      })
    );
  }

  /**
   * Get all child elements of a specific type
   */
  private _getChildrenByTag(tagName: string): HTMLElement[] {
    const set = this._trackedChildren.get(tagName.toLowerCase());
    return set ? Array.from(set) : [];
  }

  /**
   * Get all point elements
   * @param filter - Optional filter criteria
   */
  public getPoints(filter?: { visible?: boolean; id?: string }): PointElement[] {
    return filterPointsFn(this._getChildrenByTag('gk-point'), filter);
  }

  /** Get all point elements (no filter). */
  public getAllPoints(): PointElement[] {
    return this.getPoints();
  }

  /** Get one point by point-id attribute, or undefined if not found. */
  public getOnePoint(id: string): PointElement | undefined {
    return this.getPoints({ id })[0];
  }

  /**
   * Get all polygon elements
   * @param filter - Optional filter criteria
   */
  public getPolygons(filter?: {
    visible?: boolean;
    dataAttribute?: { key: string; value: string };
  }): PolygonElement[] {
    return filterPolygonsFn(this._getChildrenByTag('gk-polygon'), filter);
  }

  /** Get all polygon elements (no filter). */
  public getAllPolygons(): PolygonElement[] {
    return this.getPolygons();
  }

  /** Get one polygon matching dataAttribute, or undefined if not found. */
  public getOnePolygon(dataAttribute: { key: string; value: string }): PolygonElement | undefined {
    return this.getPolygons({ dataAttribute })[0];
  }

  /**
   * Get all isochrone elements
   * @param filter - Optional filter criteria
   */
  public getIsochrones(filter?: {
    visible?: boolean;
    selection?: boolean;
    dataAttribute?: { key: string; value: string };
  }): IsochroneElement[] {
    return filterIsochronesFn(this._getChildrenByTag('gk-isochrone'), filter);
  }

  /** Get all isochrone elements (no filter). */
  public getAllIsochrones(): IsochroneElement[] {
    return this.getIsochrones();
  }

  /** Get one isochrone matching filter, or undefined if not found. */
  public getOneIsochrone(filter: {
    visible?: boolean;
    selection?: boolean;
    dataAttribute?: { key: string; value: string };
  }): IsochroneElement | undefined {
    return this.getIsochrones(filter)[0];
  }

  /**
   * Remove all isochrones matching filter criteria
   * @param filter - Optional filter criteria
   */
  public removeIsochrones(filter?: { selection?: boolean; visible?: boolean }): void {
    const isochrones = this.getIsochrones(filter);
    isochrones.forEach((iso) => {
      iso.setAttribute('visible', 'false');
      iso.remove();
    });
  }

  /**
   * Check if map is currently populating data
   */
  public isPopulating(): boolean {
    return this.hasAttribute('data-populating');
  }

  /**
   * Set whether map is currently populating
   */
  public setPopulating(populating: boolean): void {
    if (populating) {
      this.setAttribute('data-populating', 'true');
    } else {
      this.removeAttribute('data-populating');
    }
  }

  /**
   * Pool management methods (for map-collection)
   */

  /**
   * Check if map is pool-managed
   */
  public isPoolManaged(): boolean {
    return this.hasAttribute('data-pool-managed');
  }

  /**
   * Set pool-managed state
   */
  public setPoolManaged(managed: boolean): void {
    if (managed) {
      this.setAttribute('data-pool-managed', 'true');
    } else {
      this.removeAttribute('data-pool-managed');
    }
  }

  /**
   * Check if map is in pool
   */
  public isInPool(): boolean {
    return this.hasAttribute('data-pool-map');
  }

  /**
   * Set pool state (in pool, pool index)
   */
  public setPoolState(inPool: boolean, poolIndex?: number): void {
    if (inPool) {
      this.setAttribute('data-pool-map', 'true');
      if (poolIndex !== undefined) {
        this.setAttribute('data-pool-index', poolIndex.toString());
      }
      this.removeAttribute('data-pool-managed');
    } else {
      this.removeAttribute('data-pool-map');
      this.removeAttribute('data-pool-index');
      this.setAttribute('data-pool-managed', 'true');
    }
  }

  /**
   * Get pool index
   */
  public getPoolIndex(): number | null {
    const index = this.getAttribute('data-pool-index');
    return index ? parseInt(index, 10) : null;
  }

  /**
   * Ensure map has required attributes from parent collection
   */
  public ensureAttributes(options: {
    apiKey?: string | null;
    provider?: string;
    mapStyle?: string | null;
    minZoom?: number | null;
    maxZoom?: number | null;
  }): void {
    if (options.apiKey && !this.getAttribute('api-key')) {
      this.setAttribute('api-key', options.apiKey);
    }
    if (options.provider && !this.getAttribute('provider')) {
      this.setAttribute('provider', options.provider);
    }
    if (options.mapStyle && !this.getAttribute('map-style') && !this.getAttribute('style')) {
      this.setAttribute('map-style', options.mapStyle);
    }
    if (
      options.minZoom !== null &&
      options.minZoom !== undefined &&
      !this.getAttribute('min-zoom')
    ) {
      this.setAttribute('min-zoom', String(options.minZoom));
    }
    if (
      options.maxZoom !== null &&
      options.maxZoom !== undefined &&
      !this.getAttribute('max-zoom')
    ) {
      this.setAttribute('max-zoom', String(options.maxZoom));
    }
  }

  /**
   * Check if map instance is rendering (has visible canvas)
   */
  public isRendering(): boolean {
    if (!this.map) return false;

    try {
      const getContainer = (this.map as any).getContainer;
      if (getContainer && typeof getContainer === 'function') {
        const container = getContainer.call(this.map);
        if (container) {
          const canvas = container.querySelector('canvas');
          return !!canvas && canvas.offsetWidth > 0 && canvas.offsetHeight > 0;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if map is still loading (style not yet loaded)
   */
  public isLoading(): boolean {
    if (!this.map) return false;

    try {
      // Check if style is loaded - if not, map is still loading
      if (
        typeof (this.map as any).isStyleLoaded === 'function' &&
        !(this.map as any).isStyleLoaded()
      ) {
        return true;
      }
      // Also check general loaded state
      if (typeof (this.map as any).loaded === 'function' && !(this.map as any).loaded()) {
        return true;
      }
      return false;
    } catch {
      // If we can't check, assume it's not loading
      return false;
    }
  }

  /**
   * Unfreeze the map - initialize and show when ready
   * If map is frozen, unfreezes it. Otherwise creates new map.
   * Placeholder is hidden automatically when map loads
   *
   * @param poolIndex - Optional pool index for tracking
   * @returns Promise that resolves when map is ready
   */
  public async unfreeze(poolIndex?: number): Promise<boolean> {
    // Prevent concurrent unfreeze operations
    if (this._isUnfreezing) {
      debug.warn('[gk-map] Already unfreezing, skipping duplicate call');
      return false;
    }

    this._isUnfreezing = true;

    // Set pool state
    this.setPoolState(true, poolIndex);

    try {
      // If map already exists and is initialized, no need to show placeholder (avoids flash when tabbing back to grid view)
      if (this.map && this.isInitialized) {
        this.hidePlaceholder();
        resizeAndRepaintMapFn(this.map, this);
        this.dispatchEvent(
          new CustomEvent('gk-map-unfreeze', {
            detail: { map: this.map, element: this },
            bubbles: true,
          })
        );
        return true;
      }

      // Show placeholder while loading (frozen restore or first init)
      const placeholderMsg = this._isFrozen ? 'Restoring...' : undefined;
      debug.log('[gk-map] unfreeze: showing placeholder', {
        message: placeholderMsg ?? 'default',
        _isFrozen: this._isFrozen,
      });
      this.showPlaceholder(placeholderMsg);

      // If map is frozen, unfreeze it (reinitialize since we destroyed it)
      if (this._isFrozen) {
        debug.log('[gk-map] unfreeze: calling _unfreeze (restore path)');
        await this._unfreeze();
        debug.log('[gk-map] unfreeze: _unfreeze returned', {
          isInitialized: this.isInitialized,
          hasMap: !!this.map,
        });
        // Don't wait for 'idle' - it can delay by hundreds of ms; style load is enough for layers
        if (this.isInitialized) {
          this.hidePlaceholder();
        }
        // Resize and repaint so map fills container after scroll-back (container may have been zero-size when frozen)
        resizeAndRepaintMapFn(this.map, this);
        debug.log('[gk-map] active', { label: this.getMapLabel() });
        // Dispatch unfreeze event after reinitialization completes
        // Note: initializeMap() already dispatches gk-map-ready, but we also dispatch
        // gk-map-unfreeze to make the lifecycle explicit for components that need it
        this.dispatchEvent(
          new CustomEvent('gk-map-unfreeze', {
            detail: { map: this.map, element: this },
            bubbles: true,
          })
        );
        return true;
      }

      // Initialize the map (first time or after frozen)
      debug.log('[gk-map] unfreeze: calling initializeMap (first-time init path)');
      await this.initializeMap();

      // Don't wait for 'idle' (tiles, etc.) - style load is enough for adding layers; speeds first load
      debug.log('[gk-map] unfreeze: initializeMap returned', {
        hasMap: !!this.map,
        isInitialized: this.isInitialized,
      });
      if (this.map) {
        if (this.isInitialized) {
          this.hidePlaceholder();
        }
        debug.log('[gk-map] active', { label: this.getMapLabel() });
        this.dispatchEvent(
          new CustomEvent('gk-map-unfreeze', {
            detail: { map: this.map, element: this },
            bubbles: true,
          })
        );
        return true;
      }

      this.showPlaceholder('Map failed to load');
      this.dispatchEvent(
        new CustomEvent('gk-map-failed', { detail: { element: this }, bubbles: true })
      );
      return false;
    } catch (error) {
      debug.warn('[gk-map] Failed to unfreeze:', error);
      this._isFrozen = false;
      this.showPlaceholder('Map load error');
      this.dispatchEvent(
        new CustomEvent('gk-map-failed', { detail: { element: this, error }, bubbles: true })
      );
      return false;
    } finally {
      this._isUnfreezing = false;
    }
  }

  /** Label for console logs (e.g. market slug from parent card or element id) */
  private getMapLabel(): string {
    const parent = (this as unknown as HTMLElement).closest?.('[data-map-id]');
    if (parent) return (parent.getAttribute?.('data-map-id') ?? '') || 'card';
    return (this as unknown as HTMLElement).id || 'map';
  }

  /**
   * Freeze the map - hide canvas and pause rendering
   * Destroys the WebGL context to free resources
   * Returns a Promise that resolves when the context is released
   */
  public async freeze(): Promise<void> {
    // Wait if currently unfreezing to avoid race condition
    if (this._isUnfreezing) {
      debug.warn('[gk-map] Waiting for unfreeze to complete before freezing');
      // Wait up to 10 seconds for unfreeze to complete
      const maxWait = 10000;
      const startTime = Date.now();
      while (this._isUnfreezing && Date.now() - startTime < maxWait) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Dispatch freeze event before freezing
    this.dispatchEvent(
      new CustomEvent('gk-map-freeze', {
        detail: { map: this.map, element: this },
        bubbles: true,
      })
    );

    // Show placeholder with "Restoring..." message (for when user scrolls back)
    this.showPlaceholder('Restoring...');
    // Don't run stuck timer for this placeholder: we're tearing down, not loading
    this._clearStuckCheck();

    // Destroy the map to free WebGL context
    // Browsers can only handle a few WebGL contexts, so we must destroy when frozen
    if (this.map) {
      await this._freeze();
    }

    // Update pool state - no longer in pool
    this.setPoolState(false);
    debug.log('[gk-map] frozen', { label: this.getMapLabel() });
  }

  /**
   * Remove map instance and release WebGL context.
   * Shared by freeze, re-init, and failed-load cleanup paths.
   */
  private async teardownMapInstance(options: { markFrozen: boolean }): Promise<void> {
    if (!this.map) {
      if (options.markFrozen) {
        this._isFrozen = true;
      }
      return;
    }

    // Wait if currently initializing to avoid race condition
    if (this._isInitializing) {
      debug.warn('[gk-map] Waiting for initialization to complete before teardown');
      const maxWait = 5000;
      const startTime = Date.now();
      while (this._isInitializing && Date.now() - startTime < maxWait) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!this.map) {
        if (options.markFrozen) {
          this._isFrozen = true;
        }
        return;
      }
    }

    // Dispatch unload so children (gk-layer, gk-point) remove their map listeners before we destroy the map
    this.dispatchEvent(
      new CustomEvent('gk-map-unload', {
        detail: { map: this.map, element: this },
        bubbles: true,
      })
    );

    // Remove all map listeners so no handler runs after we call map.remove()
    this.removeAllMapListeners();

    // Restore console if style-load filter was still active (e.g. theme toggle then immediate teardown)
    this._restoreStyleLoadConsole();

    if (this._maptilerErrorHandler) {
      window.removeEventListener('error', this._maptilerErrorHandler, true);
      this._maptilerErrorHandler = null;
    }

    const map = this.map as any;
    if (typeof map.remove === 'function') {
      try {
        map.remove();
      } catch (error) {
        debug.warn(
          '[gk-map] Error during map removal (map may have been partially initialized):',
          error
        );
      }
    }

    this.map = null;
    this._mapCanvas = null;
    this.isInitialized = false;
    this.hasPainted = false;
    if (options.markFrozen) {
      this._isFrozen = true;
    }

    await delayForWebGLRelease();
  }

  /**
   * Internal freeze implementation - destroy map and free WebGL context
   * Browsers can only handle a few WebGL contexts, so we must destroy when frozen
   * Returns a Promise that resolves after the context is released
   */
  private async _freeze(): Promise<void> {
    if (!this.map || this._isFrozen) {
      return;
    }

    await this.teardownMapInstance({ markFrozen: true });
  }

  /**
   * Internal unfreeze implementation - reinitialize the map
   * Since we destroy the map when frozen, we need to recreate it
   */
  private async _unfreeze(): Promise<void> {
    if (!this._isFrozen) {
      return;
    }

    debug.log('[gk-map] _unfreeze start');
    // Map was destroyed, so we need to reinitialize it
    this._isFrozen = false;

    // Wait for container to have dimensions (e.g. after scroll-back, layout may not be done yet)
    const rect = this.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      debug.log('[gk-map] _unfreeze: waiting for container dimensions', {
        width: rect.width,
        height: rect.height,
      });
      await new Promise<void>((resolve) => {
        const check = () => {
          const r = this.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      });
    }

    // Set flag to indicate map was just unfrozen - this helps isochrones restore
    this.dataset.wasJustUnfrozen = 'true';

    debug.log('[gk-map] _unfreeze: calling initializeMap');
    await this.initializeMap();
    debug.log('[gk-map] _unfreeze: initializeMap returned', { isInitialized: this.isInitialized });

    // Clear flag after a short delay to allow isochrones to restore
    setTimeout(() => {
      delete this.dataset.wasJustUnfrozen;
    }, 2000);
  }

  public async whenStyleReady(timeout: number = 2000): Promise<void> {
    return whenStyleReadyFn(this.map as any, timeout);
  }

  private resizeAndRepaintMap(): void {
    resizeAndRepaintMapFn(this.map as any, this);
  }

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

    // Prefer cameraForBounds + jumpTo — MapTiler fitBounds can NaN when canvas layout is settling.
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
        map.jumpTo?.({
          center: camera.center,
          zoom: camera.zoom,
          bearing: camera.bearing ?? bearing,
          pitch: camera.pitch ?? pitch,
          duration: 0,
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

      // Wait for viewport to settle
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });
    } catch (error) {
      console.warn('[gk-map] Error in setBounds:', error);
      // Fallback to center
      const centerLng = (minLng + maxLng) / 2;
      const centerLat = (minLat + maxLat) / 2;
      try {
        map.jumpTo?.({ center: [centerLng, centerLat], pitch, bearing });
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
  private _layerSpecWithoutUndefined(
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
      { mapElement: this, dispatchEvent: true }
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

  private pointCoordsFromFeature(
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
   * which moves the dedicated selection ring without mutating venue source data.
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
