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

import { MapConnectedInit } from './map-connected-init';
import { mapEl } from './map-el';

export class MapStyleSetup extends MapConnectedInit {
  protected mapRenderProviderName(): string {
    const attr = this.getAttribute('provider');
    if (attr) return attr;
    try {
      return this.getUIProvider().getName();
    } catch {
      return 'maptiler';
    }
  }

  protected ensureValidMapStyleAfterLoad(): void {
    if (!this.map) return;
    const apiKey = this.getAttribute('api-key') || '';
    const provider = this.mapRenderProviderName();
    ensureValidMapStyleAfterLoadFn(this.map as any, apiKey, () =>
      checkAndUpdateStyleFn(this.map as any, apiKey, provider)
    );
  }

  protected checkAndUpdateStyle(): void {
    if (!this.map) return;
    checkAndUpdateStyleFn(
      this.map as any,
      this.getAttribute('api-key') || '',
      this.mapRenderProviderName()
    );
  }

  protected setupStyleImageMissingHandler(): void {
    const map = this.map as any;
    const handler = createStyleImageMissingHandler(map);
    if (!handler) return;
    this._styleImageMissingHandler = handler;
    map.on('styleimagemissing', handler);
  }


  /** Tier D — prefetch offline tiles when host configured `MapOfflineContextLoader`. */
  protected async scheduleOfflinePrefetchOnContextLoad(): Promise<void> {
    const mapId = this.getAttribute('map-id')?.trim();
    if (!mapId) return;
    try {
      const { MapOfflineContextLoader } = await import('@local-hosting/geokit/ui/storage/map-offline-context-loader');
      const zoom = parseFloat(this.getAttribute('zoom') || '12');
      await MapOfflineContextLoader.onMapContextLoad(mapId, { zoom });
    } catch (error) {
      debug.warn('offline prefetch on context load failed', error);
    }
  }

  /**
   * Show placeholder if map is not initialized
   * The placeholder is a child of the gk-map element itself
   */
  protected showPlaceholderIfNeeded(): void {
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

    // Show spinner for loading/restoring states
    const showSpinner = text === 'Loading map...' || text === 'Restoring...';

    const selector = getPlaceholderSelector();
    const existingPlaceholder = this.querySelector(selector) as HTMLElement | null;

    if (existingPlaceholder) {
      const existingText = existingPlaceholder.getAttribute('data-message');
      if (existingText !== text) {
        existingPlaceholder.setAttribute('data-message', text);
        existingPlaceholder.innerHTML = createPlaceholderContentFn(text, showSpinner);
      }
      this._startStuckCheckIfLoading(text);
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
  protected _startStuckCheckIfLoading(message: string): void {
    if (message !== 'Loading map...' && message !== 'Restoring...') return;
    this._clearStuckCheck();
    this._stuckCheckTimer = setTimeout(() => {
      this._stuckCheckTimer = null;
      if (this.isInitialized || !this.hasPlaceholder()) return;
      debug.log('stuck: placeholder still visible after timeout', { message });
      this.isInitialized = false;
      this.showPlaceholder('Loading map...');
      this.dispatchEvent(
        new CustomEvent('gk-map-stuck', { detail: { element: this }, bubbles: true })
      );
    }, STUCK_MS);
  }

  protected _clearStuckCheck(): void {
    if (this._stuckCheckTimer !== null) {
      clearTimeout(this._stuckCheckTimer);
      this._stuckCheckTimer = null;
    }
  }

  /**
   * Hide placeholder when map is ready (public method for map collection)
   */
  public hidePlaceholder(): void {
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
  protected setupHideAttribution(): void {
    if (this.hasAttribute('show-attribution')) return;
    injectHideAttributionStylesFn();
    this.classList.add('gk-hide-attribution');
  }

  /**
   * Resolve theme chrome before first placeholder paint.
   * Explicit `theme` wins; otherwise follow the browser (`prefers-color-scheme`).
   */
  protected applyThemeChromeBeforePaint(): void {
    const themeAttr = this.getAttribute('theme');
    if (themeAttr && isValidTheme(themeAttr)) {
      this._currentTheme = getTheme(themeAttr);
      this._usingSystemTheme = false;
    } else if (!this.getAttribute('map-style')) {
      this._currentTheme = getTheme(getSystemTheme());
      this._usingSystemTheme = true;
    } else {
      // map-style without theme: tiles from attr; chrome still follows the browser
      this._currentTheme = getTheme(getSystemTheme());
    }
    this.syncThemeClass();
  }

  /**
   * Sync theme class to element: gk-theme-light or gk-theme-dark.
   * Explicit `theme` attr wins; otherwise browser preference (or active system theme).
   */
  protected syncThemeClass(): void {
    this.classList.remove('gk-theme-light', 'gk-theme-dark');
    const themeAttr = this.getAttribute('theme');
    if (themeAttr && isValidTheme(themeAttr)) {
      this.classList.add('gk-theme-' + themeAttr);
      return;
    }
    const name = this._usingSystemTheme ? this._currentTheme.name : getSystemTheme();
    this.classList.add('gk-theme-' + name);
  }

  /**
   * Set up listener for system theme changes (prefers-color-scheme).
   * Only active when no explicit theme attribute is set.
   */
  protected setupSystemThemeListener(): void {
    this.cleanupSystemThemeListener();

    this._systemThemeMediaQuery = getSystemThemeMediaQuery();
    if (!this._systemThemeMediaQuery) return;

    this._systemThemeHandler = (e: MediaQueryListEvent) => {
      // Only respond if we're still using system theme (no explicit theme attribute)
      if (!this._usingSystemTheme) return;

      const newThemeName: ThemeName = e.matches ? 'dark' : 'light';
      debug.log('System theme changed to', newThemeName);

      this._currentTheme = getTheme(newThemeName);
      this.syncThemeClass();

      // Update map tiles if map is initialized
      if (this.map) {
        mapEl(this).updateMapStyle(this._currentTheme.mapStyle);
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
  protected cleanupSystemThemeListener(): void {
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
  protected injectControlThemeStyles(): void {
    injectThemeStyles();
    const themeAttr = this.getAttribute('theme');
    if (themeAttr && isValidTheme(themeAttr)) {
      this._currentTheme = getTheme(themeAttr);
    }
    this.syncThemeClass();
  }

  /**
   * Set up auto-hide controls behavior
   * When enabled, controls are hidden until the user hovers/focuses the map
   */
  protected setupAutoHideControls(): void {
    if (!this.hasAttribute('auto-hide-controls')) return;

    injectAutoHideStylesFn();

    // Initially hide controls via class
    this.classList.add('gk-controls-hidden');
    this._controlsVisible = false;

    // Show controls on mouse enter
    this._mouseEnterHandler = () => mapEl(this).setControlsVisible(true);
    this._mouseLeaveHandler = () => mapEl(this).setControlsVisible(false);

    this.addEventListener('mouseenter', this._mouseEnterHandler);
    this.addEventListener('mouseleave', this._mouseLeaveHandler);
  }

  /**
   * Clean up auto-hide event listeners
   */
  protected cleanupAutoHideControls(): void {
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

  protected parseUrlHashState(): ReturnType<typeof parseUrlHashStateFn> {
    return parseUrlHashStateFn();
  }

  /**
   * Update URL hash with current map state
   * Uses debouncing to avoid excessive URL updates during panning
   */
  protected updateUrlHash(): void {
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

  protected applyUrlHashState(): void {
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
  protected setupBearingClamp(): void {
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

  protected cleanupBearingClamp(): void {
    if (this._bearingClampHandler && this.map) {
      this.map.off('moveend', this._bearingClampHandler);
      this._bearingClampHandler = null;
    }
  }

  protected setupSemanticMapEvents(): void {
    this.cleanupSemanticMapEvents();
    if (!this.map) return;
    this._semanticEventsCleanup = bindGkMapSemanticEvents(this, this.map as any);
  }

  protected cleanupSemanticMapEvents(): void {
    this._semanticEventsCleanup?.();
    this._semanticEventsCleanup = null;
  }

  /**
   * Set up URL hash synchronization
   * Called when map is ready and sync-url attribute is present
   */
  protected setupUrlSync(): void {
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
  protected removeAllMapListeners(): void {
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
  protected isMapOverlayEnabled(name: string): boolean {
    if (!this.hasAttribute(name)) return false;
    const value = this.getAttribute(name);
    return value !== 'false' && value !== '0';
  }

  protected setupTerrain(): void {
    this._terrainZoomHandler = createTerrainZoomHandler({
      getAttribute: (n) => this.getAttribute(n),
      map: this.map,
    });
  }

  protected cleanupTerrain(): void {
    cleanupTerrainFn(this.map, this._terrainZoomHandler);
    this._terrainZoomHandler = null;
  }

  protected setup3DBuildings(): void {
    this._buildingsZoomHandler = createBuildingsZoomHandler({
      getAttribute: (n) => this.getAttribute(n),
      map: this.map,
    });
  }

  protected cleanup3DBuildings(): void {
    cleanup3DBuildingsFn(this.map, this._buildingsZoomHandler);
    this._buildingsZoomHandler = null;
  }

  protected setupHillshade(): void {
    this._hillshadeUpdateHandler = setupHillshadeFn({
      getAttribute: (n) => this.getAttribute(n),
      map: this.map,
    });
  }

  protected cleanupHillshade(): void {
    cleanupHillshadeFn(this.map);
    this._hillshadeUpdateHandler = null;
  }

  /**
   * Clean up URL hash synchronization
   */
  protected cleanupUrlSync(): void {
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
}