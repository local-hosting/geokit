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

import { MapPublicNav } from './map-public-nav';

export class MapPublicQuery extends MapPublicNav {
  protected _onStyleLoadReaddLayers(): void {
    if (!this.map) return;
    debug.log('_onStyleLoadReaddLayers: registering style.load + 500ms fallback');

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
      debug.log('style.load fired');
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
        debug.log('style load failed, will not dispatch gk-map-style-load', {
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
        debug.log('dispatchReadd skipped', {
          fromTimeout,
          dispatched,
          scheduled,
          styleLoadFailed,
        });
        return;
      }
      scheduled = true;
      debug.log('dispatchReadd scheduled', { fromTimeout });
      // Double rAF so MapTiler's internal state is settled.
      // When fromTimeout: always dispatch so layers re-add even if style.load never fired (e.g. dark→light).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scheduled = false;
          if (dispatched || !this.map) return;
          const ready = isStyleReady();
          if (!fromTimeout && !ready) {
            debug.log('dispatchReadd: style not ready, skipping dispatch', {
              isStyleLoaded: (this.map as any)?.isStyleLoaded?.(),
            });
            return;
          }
          dispatched = true;
          cleanup();
          debug.log('dispatching gk-map-style-load', { fromTimeout, styleReady: ready });
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
          console.warn(`[gk-map] Error in disconnectedCallback for ${child.tagName}:`, error);
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
        console.warn('[gk-map] Error cleaning up dangling layers/sources:', error);
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
}
