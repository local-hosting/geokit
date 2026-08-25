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

import { MapBase } from './map-base.js';
import { mapEl } from './map-el.js';

export class MapConnectedInit extends MapBase {
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
    mapEl(this)._initializeChildTracking();

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
    mapEl(this).showPlaceholderIfNeeded();

    // Prevent re-initialization if map already exists (important for map pool reuse)
    // When maps are moved between cards, connectedCallback can be called again,
    // but we should reuse the existing map instance to avoid creating new WebGL contexts
    if (!this.isInitialized && !this.map) {
      await this.initializeMap();
    } else if (this.map && !this.isInitialized) {
      // Map exists but not marked as initialized - mark it as initialized
      // This can happen if the map was created but the load event hasn't fired yet
      this.isInitialized = true;
      mapEl(this).hidePlaceholder();
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
    mapEl(this).cleanupAutoHideControls();

    // Clean up URL sync listeners
    mapEl(this).cleanupUrlSync();

    // Clean up system theme listener
    mapEl(this).cleanupSystemThemeListener();

    mapEl(this)._cleanupChildTracking();
    mapEl(this)._clearStuckCheck();

    // Release WebGL when permanently removed from the document (skip brief disconnect during moves)
    queueMicrotask(() => {
      if (!this.isConnected && this.map && !this._isFrozen) {
        void mapEl(this).freeze().catch(() => {});
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
      await mapEl(this).teardownMapInstance({ markFrozen: false });
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
            debug.warn('[gk-map] Auto-initializing MapTiler provider from api-key attribute');
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
        mapEl(this).setupSystemThemeListener();
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
      const urlState = this.hasAttribute('sync-url') ? mapEl(this).parseUrlHashState() : null;

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

      // Create map; if browser is at WebGL context limit, wait for pool eviction first
      const canCreate = await waitUntilCanCreateMap();
      if (!canCreate) {
        debug.warn('[gk-map] WebGL budget full, deferring map creation');
        mapEl(this).showPlaceholder('Loading map...');
        this.isInitialized = false;
        this._isInitializing = false;
        return;
      }

      try {
        this.map = await provider.createMap(container, options);
        if (!this._registeredForWebGLBudget) {
          registerLiveMap();
          this._registeredForWebGLBudget = true;
        }
      } catch (err) {
        debug.warn('[gk-map] Map creation failed (e.g. too many WebGL contexts):', err);
        mapEl(this).showPlaceholder('Loading map...');
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
      mapEl(this).setupStyleImageMissingHandler();

      // Ensure map has a valid, non-deprecated style after creation
      // This handles cases where the SDK might default to deprecated styles
      // Wait for style to load before trying to set it
      mapEl(this).ensureValidMapStyleAfterLoad();

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
      mapEl(this).setupHideAttribution();
      mapEl(this).injectControlThemeStyles();

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
        mapEl(this).hidePlaceholder();

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

        void mapEl(this).scheduleOfflinePrefetchOnContextLoad();

        // 3D terrain / hillshade are opt-in via attributes (default off)
        if (mapEl(this).isMapOverlayEnabled('terrain-enabled') && this.getAttribute('terrain-min-zoom')) {
          mapEl(this).setupTerrain();
        } else {
          mapEl(this).cleanupTerrain();
        }

        // 3D buildings: enable when zoom >= buildings-min-zoom (if set)
        mapEl(this).setup3DBuildings();

        if (mapEl(this).isMapOverlayEnabled('hillshade-enabled')) {
          mapEl(this).setupHillshade();
        } else {
          mapEl(this).cleanupHillshade();
        }

        // Defer non-critical setup to avoid blocking first paint
        const deferredSetup = () => {
          mapEl(this).setupSemanticMapEvents();
          mapEl(this).setupAutoHideControls();
          mapEl(this).setupBearingClamp();
          mapEl(this).setupUrlSync();
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
              mapEl(this).showPlaceholder('Loading map...');
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
      mapEl(this).showPlaceholder('Loading map...');
      this.isInitialized = false;
      this.dispatchEvent(
        new CustomEvent('gk-map-failed', { detail: { element: this, error }, bubbles: true })
      );
    } finally {
      this._isInitializing = false;
    }
  }

}