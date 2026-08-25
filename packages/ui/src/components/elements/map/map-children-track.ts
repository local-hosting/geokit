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

import { MapPublicQuery } from './map-public-query.js';

export class MapChildrenTrack extends MapPublicQuery {
  protected _initializeChildTracking(): void {
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
  protected _cleanupChildTracking(): void {
    if (this._childObserver) {
      this._childObserver.disconnect();
      this._childObserver = null;
    }
    this._trackedChildren.clear();
  }

  /**
   * Track a child element by its tag name
   */
  protected _trackChild(element: HTMLElement): void {
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
  protected _untrackChild(element: HTMLElement): void {
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
  protected _getChildrenByTag(tagName: string): HTMLElement[] {
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
}
