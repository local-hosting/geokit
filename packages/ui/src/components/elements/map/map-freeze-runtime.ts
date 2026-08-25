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

import { MapChildrenTrack } from './map-children-track.js';

export class MapFreezeRuntime extends MapChildrenTrack {
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
  protected getMapLabel(): string {
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
  protected async teardownMapInstance(options: { markFrozen: boolean }): Promise<void> {
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
    if (this._registeredForWebGLBudget) {
      unregisterLiveMap();
      this._registeredForWebGLBudget = false;
    }
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
  protected async _freeze(): Promise<void> {
    if (!this.map || this._isFrozen) {
      return;
    }

    await this.teardownMapInstance({ markFrozen: true });
  }

  /**
   * Internal unfreeze implementation - reinitialize the map
   * Since we destroy the map when frozen, we need to recreate it
   */
  protected async _unfreeze(): Promise<void> {
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

  protected resizeAndRepaintMap(): void {
    resizeAndRepaintMapFn(this.map as any, this);
  }
}
