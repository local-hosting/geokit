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
  mapStyleSwapOptions,
  styleWithPreservedOverlays,
  type StyleOverlaySpec,
} from './style/preserve-custom-style-overlays';
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

import { MapControlsState } from './map-controls-state';
import { mapEl } from './map-el';

export class MapPublicNav extends MapControlsState {
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


  public on<E extends GkMapListenEvent>(
    event: E,
    handler: GkMapEventHandler<E>
  ): () => void {
    return onGkMapEvent(this, event, handler);
  }

  public off<E extends GkMapListenEvent>(
    event: E,
    handler: GkMapEventHandler<E>
  ): void {
    offGkMapEvent(this, event, handler);
  }

  public getBounds(): unknown {
    const map = this.map as { getBounds?: () => unknown } | null;
    return map?.getBounds?.();
  }

  public getZoom(): number | undefined {
    const map = this.map as { getZoom?: () => number } | null;
    return map?.getZoom?.();
  }

  public getCenter(): { lng: number; lat: number } | undefined {
    const map = this.map as { getCenter?: () => { lng: number; lat: number } } | null;
    return map?.getCenter?.();
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
  protected applyTheme(themeName: ThemeName): void {
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
  protected _installStyleLoadConsoleFilter(): void {
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

  protected _restoreStyleLoadConsole(): void {
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
  protected updateMapStyle(styleName: string): void {
    void this._updateMapStyleAsync(styleName);
  }

  /** Theme/style swap — prefer async proxied StyleSpec when the provider can resolve one. */
  protected async _updateMapStyleAsync(styleName: string): Promise<void> {
    if (!this.map) return;

    const map = this.map as any;
    if (typeof map.setStyle !== 'function') return;
    debug.log('[gk-map] updateMapStyle', { styleName });

    // MapTiler SDK logs "The distant style could not be loaded" in its own error handler; we cannot prevent it.
    // Temporarily filter that single message so the console stays clean when theme/style load fails.
    this._installStyleLoadConsoleFilter();

    // MapTiler often ignores transformStyle — pre-merge overlays into object styles before commit.
    const commitStyle = (next: string | StyleOverlaySpec | object): void => {
      const previous =
        typeof map.getStyle === 'function' ? (map.getStyle() as StyleOverlaySpec) : null;
      const merged = styleWithPreservedOverlays(
        previous,
        next as string | StyleOverlaySpec
      );
      mapEl(this)._onStyleLoadReaddLayers();
      map.setStyle(merged, mapStyleSwapOptions());
    };

    const providerName = this.getAttribute('provider') || 'maptiler';
    const provider = getUIProviderByName(providerName);

    // Resolve style first. Prefer resolveStyleForTheme (MapTiler + proxy inlines TileJSON) so
    // workers do not fetch api.maptiler.com without Referer after a light/dark toggle.
    const resolveStyle =
      typeof provider?.resolveStyleForTheme === 'function'
        ? () => provider.resolveStyleForTheme!(styleName)
        : typeof provider?.getStyleForTheme === 'function'
          ? async () => provider.getStyleForTheme!(styleName)
          : null;

    if (resolveStyle) {
      const styleForTheme = await resolveStyle();
      if (styleForTheme == null) {
        if (providerName === 'maptiler' || providerName === 'protomaps') {
          debug.log(
            '[gk-map] updateMapStyle skipped: no style for provider (set an API key, style URL, or PMTiles archive)'
          );
          return;
        }
        // Other providers: no style for this theme name, fall through to fallbacks
      } else {
        try {
          debug.log('[gk-map] setStyle via provider resolveStyleForTheme/getStyleForTheme', {
            provider: providerName,
            style: typeof styleForTheme === 'string' ? styleForTheme : '(object)',
          });
          commitStyle(styleForTheme);
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
        commitStyle(styleUrl);
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
          commitStyle(sdkStyle as StyleOverlaySpec | string);
          return;
        } catch (error) {
          console.warn('[gk-map] Failed to update map style via SDK:', error);
        }
      }
    }

    if (apiKey) {
      try {
        const styleUrl = `https://api.maptiler.com/maps/${normalized}/style.json?key=${apiKey}`;
        commitStyle(styleUrl);
      } catch (error) {
        console.warn('[gk-map] Failed to update map style:', error);
      }
    }
  }

  /**
   * Theme swaps use `mapStyleSwapOptions()` so app overlays survive `setStyle`.
   * `gk-map-style-load` remains a safety net when overlays cannot be preserved.
   */
}