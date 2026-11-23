/**
 * Map Component
 *
 * Main map container component
 *
 * Usage:
 * <gk-map lat="40.7128" lng="-74.006" zoom="10" style="streets"></gk-map>
 */

import {
  registerUIProvider,
  getProviderByName,
  setUIProvider,
} from '../../../providers/registry';
import { ensureMaptilerUIProviderRegistered } from '../../../providers/lazy-ui-provider';
import {
  getTheme,
  isValidTheme,
  getSystemTheme,
} from '../../../utils/theme';
import { debug } from '../../../utils/logger';
import { shouldSilenceStyleLoadPoll } from './style/style-load-poll-guard';
import { resolveInitialMapStyle } from './style/resolve-initial-map-style';
import { isUpgradedMapCollectionAncestor } from './is-upgraded-map-collection';


import {
  classifyMapInitFailure,
  mapUnavailableLogDetail,
  mapUnavailableMessage,
} from './style/map-unavailable-message';
import {
  isMaplibreLayoutCssLoaded,
} from './style/map-controls-styles';
import { ensureMapboxGlCss, ensureMaplibreGlCss } from '../../../utils/map-provider-css';








import {
  delayForWebGLRelease,
  registerLiveMap,
  waitUntilCanCreateMap,
} from './lifecycle/map-freeze';





import { MapBase } from './map-base';
import { applyMapHostLayoutFromAncestors, measureMapHostLayout } from './map-host-layout';
import { mapEl } from './map-el';
import { clampMapZoom } from './map-url-sync';

/** How long a detached gk-map keeps its map before releasing WebGL. */
const DETACHED_FREEZE_GRACE_MS = 300;

const detachedMaps = new Set<MapConnectedInit>();

export class MapConnectedInit extends MapBase {
  async connectedCallback(): Promise<void> {
    this.cancelDetachedFreeze();
    this.releaseReplacedMaps();

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

    // Defer only to an *upgraded* gk-map-collection. An unregistered tag still matches
    // closest(), and would leave maps blank forever (elements-lite does not define it).
    if (isUpgradedMapCollectionAncestor(this)) {
      this.setAttribute('data-pool-managed', 'true');
      return;
    }

    // If map is pool-managed (has data-pool-managed attribute), don't auto-initialize
    // It will be initialized explicitly via activateMap()
    if (this.hasAttribute('data-pool-managed')) {
      return;
    }

    // Frozen while still in the tree (e.g. brief Vue patch disconnect or Vite module dispose)
    if (this._isFrozen && !this.map && this.isConnected) {
      void mapEl(this).unfreeze();
      return;
    }

    // Theme class before placeholder so first paint matches theme attr / browser preference
    mapEl(this).applyThemeChromeBeforePaint();
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
    mapEl(this)._cleanupChildTracking();
    mapEl(this)._clearStuckCheck();
    this.scheduleDetachedFreeze();

    // Don't call super.disconnectedCallback() because it resets this.map = null
    // We want to preserve the map instance for reuse in the map pool
    // Only clean up if we have a flag indicating permanent removal
    // For now, we preserve the map instance - it will be cleaned up
    // when the element is actually removed from the DOM permanently
    // (which doesn't happen in map pool reuse scenarios)
  }

  /**
   * Release listeners and WebGL only if the element stays detached past the grace window.
   * Framework re-renders and Vite HMR re-attach the same element well within it, keeping the map.
   */
  protected scheduleDetachedFreeze(): void {
    this.cancelDetachedFreeze();
    detachedMaps.add(this);
    this._detachedFreezeTimer = setTimeout(() => this.releaseDetached(), DETACHED_FREEZE_GRACE_MS);
  }

  protected cancelDetachedFreeze(): void {
    detachedMaps.delete(this);
    if (this._detachedFreezeTimer === null) return;
    clearTimeout(this._detachedFreezeTimer);
    this._detachedFreezeTimer = null;
  }

  /** Free WebGL from a detached map this element replaces (framework remount with the same id). */
  protected releaseReplacedMaps(): void {
    if (!this.id) return;
    for (const detached of detachedMaps) {
      if (detached !== this && detached.id === this.id) {
        detached.releaseDetached();
      }
    }
  }

  private releaseDetached(): void {
    this.cancelDetachedFreeze();
    if (this.isConnected) return;
    mapEl(this).cleanupAutoHideControls();
    mapEl(this).cleanupUrlSync();
    mapEl(this).cleanupSystemThemeListener();
    if (this.map && !this._isFrozen) {
      void mapEl(this).freeze().catch(() => {});
    }
  }

  protected protomapsConfigFromAttributes(): {
    apiKey?: string;
    styleUrl?: string;
    pmtilesUrl?: string;
    labelLanguage?: string;
  } {
    // Access env var - Vite will replace import.meta.env at build time
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - import.meta is available in ESNext modules
    const envKey = import.meta.env?.PROTOMAPS_KEY || import.meta.env?.GEOKIT_PROTOMAPS_KEY;
    const apiKey = this.getAttribute('api-key') || envKey || undefined;
    const styleUrl = this.getAttribute('style-url') || undefined;
    const pmtilesUrl = this.getAttribute('pmtiles-url') || undefined;
    const labelLanguage = this.getAttribute('label-language') || undefined;
    return {
      ...(apiKey ? { apiKey } : {}),
      ...(styleUrl ? { styleUrl } : {}),
      ...(pmtilesUrl ? { pmtilesUrl } : {}),
      ...(labelLanguage ? { labelLanguage } : {}),
    };
  }

  async initializeMap(): Promise<void> {
    // Reuse a live map — creating another instance leaks WebGL contexts
    if (this.map && this.isInitialized && !this._isFrozen) {
      return;
    }

    if (this._initializeInFlight) {
      return this._initializeInFlight;
    }

    const inFlight = this.runInitializeMap().finally(() => {
      this._initializeInFlight = null;
    });
    this._initializeInFlight = inFlight;
    return inFlight;
  }

  /** Retry init when WebGL budget or transient createMap failure left the placeholder visible. */
  protected scheduleStandaloneInitRetry(delayMs: number = 750): void {
    if (!this.isConnected || this.hasAttribute('data-pool-managed')) return;
    if (isUpgradedMapCollectionAncestor(this)) return;
    if (this.map) return;
    window.setTimeout(() => {
      if (!this.isConnected || this.map || this._isInitializing) return;
      void this.initializeMap();
    }, delayMs);
  }

  protected noteMapInitSkip(reason: string, extra?: Record<string, unknown>): void {
    this._lastInitSkipReason = reason;
    debug.warn('init skipped', {
      reason,
      id: (this as HTMLElement).id || undefined,
      poolManaged: this.hasAttribute('data-pool-managed'),
      layout: measureMapHostLayout(this as HTMLElement),
      ...extra,
    });
  }

  private async runInitializeMap(): Promise<void> {
    this._lastInitSkipReason = null;
    // Tear down any stale/partial map before acquiring the init lock
    if (this.map) {
      await mapEl(this).teardownMapInstance({ markFrozen: false });
    }

    this._isInitializing = true;

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
          await ensureMapboxGlCss();
        } else if (providerName === 'protomaps') {
          if (!isMaplibreLayoutCssLoaded()) {
            await ensureMaplibreGlCss();
          }
        }

        if (!existingProvider) {
          // Provider not registered, register and initialize it
          if (providerName === 'maptiler') {
            await ensureMaptilerUIProviderRegistered();
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
            const styleUrl = this.getAttribute('style-url') || undefined;
            provider = await getProviderByName(
              'mapbox',
              token || styleUrl
                ? {
                    ...(token ? { accessToken: token } : {}),
                    ...(styleUrl ? { styleUrl } : {}),
                  }
                : undefined
            );
          } else if (providerName === 'protomaps') {
            const { ProtomapsUIProvider } = await import('../../../providers/protomaps-provider');
            registerUIProvider('protomaps', new ProtomapsUIProvider());
            provider = await getProviderByName('protomaps', this.protomapsConfigFromAttributes());
          } else {
            throw new Error(
              `Unknown provider: ${providerName}. Supported: maptiler, mapbox, protomaps`
            );
          }
        } else {
          // Initialize existing provider with config (if provided)
          let config:
            | { accessToken?: string }
            | { apiKey?: string; styleUrl?: string; pmtilesUrl?: string; labelLanguage?: string }
            | undefined = undefined;
          if (providerName === 'mapbox') {
            // Access env var - Vite will replace import.meta.env at build time
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - import.meta is available in ESNext modules
            const token = accessToken || import.meta.env?.MAPBOX_TOKEN;
            const styleUrl = this.getAttribute('style-url') || undefined;
            if (token || styleUrl) {
              config = {
                ...(token ? { accessToken: token } : {}),
                ...(styleUrl ? { styleUrl } : {}),
              };
            }
          } else if (providerName === 'protomaps') {
            config = this.protomapsConfigFromAttributes();
          } else if (apiKey) {
            config = { apiKey };
          }
          provider = await getProviderByName(providerName, config);
        }
        await setUIProvider(providerName);
      } else {
        // Auto-initialize MapTiler provider if api-key is present
        try {
          provider = this.getUIProvider(); // Check if default provider exists
        } catch {
          // No provider set, auto-initialize MapTiler if we have an API key
          if (apiKey) {
            debug.warn('Auto-initializing MapTiler provider from api-key attribute');
            await ensureMaptilerUIProviderRegistered();
            provider = await getProviderByName('maptiler', { apiKey });
            if (!this.getAttribute('provider')) {
              this.setAttribute('provider', 'maptiler');
            }
            await setUIProvider('maptiler');
          } else {
            throw new Error(
              'No UI provider set. Add provider="maptiler", provider="mapbox", or provider="protomaps", or provide api-key for auto MapTiler initialization'
            );
          }
        }
      }

      const container = this as HTMLElement;

      if (!container) {
        throw new Error('Map container not found');
      }

      applyMapHostLayoutFromAncestors(this);

      // First-paint style: host style-url (Corio) > map-style > theme stock name.
      // DO NOT use 'style' attribute - that's for CSS, not map tiles!
      const themeAttr = this.getAttribute('theme');
      const mapStyleAttr = this.getAttribute('map-style');
      const styleUrlAttr = this.getAttribute('style-url');
      if (themeAttr && isValidTheme(themeAttr)) {
        this._currentTheme = getTheme(themeAttr);
        this._usingSystemTheme = false;
      } else if (mapStyleAttr || styleUrlAttr) {
        this._usingSystemTheme = false;
        if (!themeAttr) {
          this._currentTheme = getTheme(getSystemTheme());
        }
      } else {
        const systemThemeName = getSystemTheme();
        this._currentTheme = getTheme(systemThemeName);
        this._usingSystemTheme = true;
        mapEl(this).setupSystemThemeListener();
      }

      const styleAttr = resolveInitialMapStyle({
        styleUrl: styleUrlAttr,
        mapStyleAttr,
        themeMapStyle: themeAttr && isValidTheme(themeAttr) ? this._currentTheme.mapStyle : null,
        systemMapStyle: this._currentTheme.mapStyle,
      });

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
      const attributeZoom = parseFloat(this.getAttribute('zoom') || '2');
      const initialZoom = urlState?.zoom ?? attributeZoom;

      const options = {
        lat: urlState?.lat ?? parseFloat(this.getAttribute('lat') || '0'),
        lng: urlState?.lng ?? parseFloat(this.getAttribute('lng') || '0'),
        zoom: clampMapZoom(initialZoom, { minZoom, maxZoom }),
        minZoom,
        maxZoom,
        pitch: urlState?.pitch ?? parseFloat(this.getAttribute('pitch') || '0'),
        maxPitch,
        bearing: urlState?.bearing ?? parseFloat(this.getAttribute('bearing') || '0'),
        style: styleAttr,
        interactive: this.getAttribute('interactive') !== 'false',
      };

      // Create map; if browser is at WebGL context limit, wait for pool eviction first
      let canCreate = await waitUntilCanCreateMap();
      if (!canCreate) {
        debug.warn('WebGL budget full, waiting for pool eviction');
        mapEl(this).showPlaceholder('Loading map...');
        this.isInitialized = false;
        await delayForWebGLRelease(500);
        if (!this.isConnected) {
          this.noteMapInitSkip('disconnected-during-webgl-wait');
          return;
        }
        canCreate = await waitUntilCanCreateMap();
        if (!canCreate) {
          this.noteMapInitSkip('webgl-budget-full');
          debug.warn('WebGL budget still full after retry');
          this.scheduleStandaloneInitRetry(1000);
          return;
        }
      }

      try {
        this.map = await provider.createMap(container, options);
        if (!this._registeredForWebGLBudget) {
          registerLiveMap();
          this._registeredForWebGLBudget = true;
        }
      } catch (err) {
        debug.warn('Map creation failed (e.g. too many WebGL contexts):', err);
        mapEl(this).showPlaceholder('Loading map...');
        this.isInitialized = false;
        await delayForWebGLRelease(500);
        if (this.isConnected && !this.map) {
          const retryOk = await waitUntilCanCreateMap(4000);
          if (retryOk) {
            try {
              this.map = await provider.createMap(container, options);
              if (this.map && !this._registeredForWebGLBudget) {
                registerLiveMap();
                this._registeredForWebGLBudget = true;
              }
            } catch (retryErr) {
              this.noteMapInitSkip('create-map-retry-failed', {
                error: retryErr instanceof Error ? retryErr.message : String(retryErr),
              });
              debug.warn('Map creation retry failed:', retryErr);
              this.scheduleStandaloneInitRetry();
              return;
            }
          }
        }
        if (!this.map) {
          this.noteMapInitSkip('create-map-failed', {
            error: err instanceof Error ? err.message : String(err),
          });
          this.scheduleStandaloneInitRetry();
          return;
        }
      }

      const mapInstance = this.map;
      if (!mapInstance) {
        this.noteMapInitSkip('create-map-null-instance');
        this.isInitialized = false;
        this.scheduleStandaloneInitRetry();
        return;
      }

      // Wrap queryRenderedFeatures so MapTiler SDK internal calls (e.g. mousemove) don't throw
      // "unknown feature value" when parsing vector tiles in Safari
      if (mapInstance.queryRenderedFeatures) {
        const original = mapInstance.queryRenderedFeatures.bind(mapInstance);
        mapInstance.queryRenderedFeatures = (
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
      const mapAny = mapInstance as {
        setFeatureState?: (
          state: { source: string; id: string | number },
          props: Record<string, unknown>
        ) => void;
        removeFeatureState?: (state: { source: string; id: string | number }) => void;
      };
      if (mapAny.setFeatureState) {
        const originalSet = mapAny.setFeatureState.bind(mapInstance);
        mapAny.setFeatureState = (state, props) => {
          // Skip before the source is on the style — Mapbox fires a hard error otherwise.
          if (mapInstance.getSource && !mapInstance.getSource(state.source)) return;
          try {
            originalSet(state, props);
          } catch {
            // MapTiler can throw "unknown feature value" when touching feature-state
          }
        };
      }
      if (mapAny.removeFeatureState) {
        const originalRemove = mapAny.removeFeatureState.bind(mapInstance);
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

        debug.log('ready', { label: this.getMapLabel() });

        // Dispatch map-ready immediately so layers can be added
        this.dispatchEvent(
          new CustomEvent('gk-map-ready', {
            detail: { map: this.map, element: this },
            bubbles: true,
          })
        );

        void mapEl(this).scheduleOfflinePrefetchOnContextLoad();

        // 3D terrain / hillshade are opt-in via attributes (default off)
        if (mapEl(this).isMapOverlayEnabled('terrain-enabled')) {
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
        dispatchMapReady();
      } else {
        if (this.map) {
          this.map.once('load', () => {
            this.clearStyleLoadPoll();
            dispatchMapReady();
          });
          // Fallback: if 'load' never fires but style has loaded (e.g. pool/managed timing), unblock placeholder
          const fallbackMs = 500;
          const fallbackMax = 10; // 5s total (style load or plain unavailable placeholder)
          let fallbackCount = 0;
          this.clearStyleLoadPoll();
          this._styleLoadPollInterval = window.setInterval(() => {
            if (shouldSilenceStyleLoadPoll({ hasMap: Boolean(this.map), isFrozen: this._isFrozen })) {
              this.clearStyleLoadPoll();
              return;
            }
            fallbackCount += 1;
            const map = this.map as { isStyleLoaded?: () => boolean } | undefined;
            if (typeof map?.isStyleLoaded === 'function' && map.isStyleLoaded()) {
              this.clearStyleLoadPoll();
              dispatchMapReady();
              return;
            }
            if (fallbackCount >= fallbackMax) {
              this.clearStyleLoadPoll();
              const kind = 'style-timeout' as const;
              console.error(
                '[gk-map]',
                mapUnavailableLogDetail(kind),
                { _isFrozen: this._isFrozen, check: fallbackCount },
              );
              mapEl(this).showPlaceholder(mapUnavailableMessage(kind));
              this.isInitialized = false;
              this.dispatchEvent(
                new CustomEvent('gk-map-failed', {
                  detail: { element: this, reason: kind },
                  bubbles: true,
                }),
              );
              return;
            }
          }, fallbackMs) as number;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const kind = classifyMapInitFailure(message);
      if (kind === 'webgl') {
        debug.warn(mapUnavailableLogDetail(kind, message));
      } else {
        console.error('[gk-map]', mapUnavailableLogDetail(kind, message), error);
      }
      mapEl(this).showPlaceholder(mapUnavailableMessage(kind));
      this.isInitialized = false;
      this.dispatchEvent(
        new CustomEvent('gk-map-failed', {
          detail: { element: this, error, reason: kind },
          bubbles: true,
        })
      );
    } finally {
      this._isInitializing = false;
    }
  }

}