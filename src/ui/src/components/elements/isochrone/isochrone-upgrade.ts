/**
 * Geokit Isochrone Component
 *
 * Displays isochrone (travel time) polygons on the map
 * Supports both smooth polygon rendering and H3 hexagon rendering
 *
 * Usage:
 * <gk-isochrone lat="40.7128" lng="-74.0060" time="15" mode="driving"></gk-isochrone>
 * <gk-isochrone lat="40.7128" lng="-74.0060" time="15" mode="driving" render="h3" h3-resolution="7"></gk-isochrone>
 */

import { MapChildElement } from '../../map-child-element';
import { getServiceForCapability } from '@geokit/service/registry';
import { smoothFeatureCollection } from '@geokit/core';
import { debug } from '../../../utils/logger';
import { getCSSVariable, getCSSVariableNumber } from '../../../utils/theme';
import { convertIsochroneToH3 } from './isochrone-h3-load';
import { getIsochroneCacheKey } from './isochrone-fetch';
import {
  buildChoroplethFillPaint,
  type FillAntialiasMap,
} from '../../../utils/choropleth-fill-paint';

import { isochroneEl } from './isochrone-el';
export interface IsochroneOptions {
  lat: number;
  lng: number;
  time: number; // in minutes
  mode?: 'driving' | 'walking' | 'cycling';
  color?: string;
  opacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  /** Pre-computed isochrone data (GeoJSON FeatureCollection) - skips API fetch when provided */
  data?: GeoJSON.FeatureCollection;
}

import { IsochroneFetchRender } from './isochrone-fetch-render';

export class IsochroneUpgrade extends IsochroneFetchRender {
  protected cleanupExistingLayers(): void {
    if (isochroneEl(this).map) {
      isochroneEl(this).cleanupMapLayers(
        [isochroneEl(this).lineLayerId, isochroneEl(this).fillLayerId].filter(Boolean) as string[],
        [isochroneEl(this).sourceId].filter(Boolean) as string[]
      );
    } else if (isochroneEl(this).lineLayerId || isochroneEl(this).fillLayerId || isochroneEl(this).sourceId) {
      // Map is null but we still have layer IDs - try to clean up via parent map element
      const mapElement = isochroneEl(this).mapElement;
      if (mapElement) {
        const mapInstance = (mapElement as any).getMap?.();
        if (mapInstance) {
          try {
            if (isochroneEl(this).lineLayerId && mapInstance.getLayer?.(isochroneEl(this).lineLayerId)) {
              mapInstance.removeLayer?.(isochroneEl(this).lineLayerId);
            }
            if (isochroneEl(this).fillLayerId && mapInstance.getLayer?.(isochroneEl(this).fillLayerId)) {
              mapInstance.removeLayer?.(isochroneEl(this).fillLayerId);
            }
            if (isochroneEl(this).sourceId && mapInstance.getSource?.(isochroneEl(this).sourceId)) {
              mapInstance.removeSource?.(isochroneEl(this).sourceId);
            }
          } catch {
            // Silently ignore - map may be in invalid state
          }
        }
      }
    }
    // Note: Do NOT clear IDs here - they will be reused for new layers
  }

  /**
   * Full cleanup - remove layers AND clear all references
   * Used when element is being destroyed or map is unloaded
   */
  protected removeIsochrone(): void {
    // Clean up layers
    isochroneEl(this).cleanupExistingLayers();

    // Clear references (full cleanup)
    isochroneEl(this).lineLayerId = null;
    isochroneEl(this).fillLayerId = null;
    isochroneEl(this).sourceId = null;
    isochroneEl(this).currentCacheKey = null;
  }

  /**
   * Apply upgraded GeoJSON to the source and dispatch event in the next frame.
   * Deferring avoids mutating the map during requestIdleCallback (MapTiler coalesceChanges).
   */
  protected applyUpgradedDataAndDispatch(
    source: unknown,
    upgradedData: GeoJSON.FeatureCollection,
    targetResolution: number
  ): void {
    const sourceWithSetData = source as { setData?: (data: unknown) => void };
    requestAnimationFrame(() => {
      if (source && typeof sourceWithSetData.setData === 'function') {
        sourceWithSetData.setData(upgradedData);
      }
      isochroneEl(this).dispatchEvent(
        new CustomEvent('isochrone-upgraded', {
          detail: {
            lat: parseFloat(isochroneEl(this).getAttribute('lat') || '0'),
            lng: parseFloat(isochroneEl(this).getAttribute('lng') || '0'),
            resolution: targetResolution,
            element: this,
          },
          bubbles: true,
        })
      );
    });
  }

  /**
   * Convert raw polygon to H3 hexagons when user interacts with the map
   * Initial render uses raw polygon for instant visibility
   * This conversion happens on zoom/interaction for better visual quality
   */
  protected async upgradeResolution(targetResolution: number): Promise<void> {
    if (!isochroneEl(this).map || !isochroneEl(this).sourceId || isochroneEl(this).render !== 'h3' || isochroneEl(this).hasUpgradedResolution) {
      return;
    }

    // Final visibility check before expensive conversion
    if (isochroneEl(this).isElementVisible === false) {
      return; // Don't upgrade off-screen isochrones
    }

    // Mark as upgraded to prevent multiple conversions
    isochroneEl(this).hasUpgradedResolution = true;

    try {
      // Get original API result (stored during fetch - this is the raw polygon)
      const originalData = (this as any)._originalIsochroneData;
      if (!originalData) {
        // If we don't have original data, try to get from source
        if (!isochroneEl(this).sourceId || !isochroneEl(this).map?.getSource) {
          isochroneEl(this).hasUpgradedResolution = false;
          return;
        }
        const source = isochroneEl(this).map.getSource(isochroneEl(this).sourceId) as {
          _data?: GeoJSON.FeatureCollection;
          setData?: (data: unknown) => void;
        };
        if (!source || !source._data) {
          isochroneEl(this).hasUpgradedResolution = false; // Reset so we can try again
          return;
        }

        // Try to convert from current source data (guard: source may have been removed by setStyle)
        const upgradedData = await convertIsochroneToH3(source._data, isochroneEl(this).h3Resolution, {
          color: isochroneEl(this).color,
          opacity: isochroneEl(this).opacity,
        });
        isochroneEl(this).applyUpgradedDataAndDispatch(source, upgradedData, targetResolution);
        return;
      }

      // Convert original raw polygon to H3 hexagons at target resolution
      // This is the expensive operation, but we're doing it during idle time
      const upgradedData = await convertIsochroneToH3(originalData, isochroneEl(this).h3Resolution, {
        color: isochroneEl(this).color,
        opacity: isochroneEl(this).opacity,
      });

      // Validate conversion produced features
      if (!upgradedData || !upgradedData.features || upgradedData.features.length === 0) {
        debug.warn('[gk-isochrone] H3 conversion produced no features, keeping raw polygon');
        isochroneEl(this).hasUpgradedResolution = false; // Reset so we can try again
        return;
      }

      // Defer setData to next frame so we don't run during requestIdleCallback (avoids MapTiler coalesceChanges)
      if (!isochroneEl(this).sourceId || !isochroneEl(this).map?.getSource) return;
      const source = isochroneEl(this).map.getSource(isochroneEl(this).sourceId) as unknown;
      isochroneEl(this).applyUpgradedDataAndDispatch(source, upgradedData, targetResolution);
    } catch (error) {
      debug.warn(`[gk-isochrone] Failed to convert to H3 hexagons:`, error);
      // Reset on error so we can try again
      isochroneEl(this).hasUpgradedResolution = false;
    }
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (isochroneEl(this).isInitialized && oldValue !== newValue) {
      if (name === 'visible') {
        isochroneEl(this).toggleVisibility();
      } else {
        // Clear cache key to force re-fetch when attributes change
        // This ensures the isochrone updates even if there's a timing issue
        if (name === 'time' || name === 'mode') {
          isochroneEl(this).currentCacheKey = null;
        }
        if (name === 'render' && newValue === 'h3') {
          isochroneEl(this).setupMapInteractionListeners();
        }
        isochroneEl(this).waitForStyleLoaded(() => isochroneEl(this).fetchAndRenderIsochrone());
      }
    }
  }

  protected toggleVisibility(): void {
    if (!isochroneEl(this).map) return;

    // Guard against map with no style (WebGL context lost or map being destroyed)
    try {
      const style = (isochroneEl(this).map as { getStyle?: () => unknown })?.getStyle?.();
      if (!style) return;
    } catch {
      // Map may be in invalid state during destruction
      return;
    }

    const visibility = isochroneEl(this).visible ? 'visible' : 'none';

    try {
      if (isochroneEl(this).fillLayerId && isochroneEl(this).map?.getLayer?.(isochroneEl(this).fillLayerId)) {
        isochroneEl(this).map?.setLayoutProperty?.(isochroneEl(this).fillLayerId, 'visibility', visibility);
      }

      if (isochroneEl(this).lineLayerId && isochroneEl(this).map?.getLayer?.(isochroneEl(this).lineLayerId)) {
        isochroneEl(this).map?.setLayoutProperty?.(isochroneEl(this).lineLayerId, 'visibility', visibility);
      }
    } catch {
      // Silently ignore - map may be in invalid state during context loss
    }
  }

  protected override onMapUnload(): void {
    // Clean up hover handlers before map reference is cleared
    isochroneEl(this).cleanupHoverHandlers();
    // Clean up layers when map is frozen/unloaded
    // This ensures proper cleanup even if element stays in DOM
    isochroneEl(this).removeIsochrone();
    super.onMapUnload();
  }

  override disconnectedCallback(): void {
    // Clean up hover handlers
    isochroneEl(this).cleanupHoverHandlers();

    // Clean up map interaction listeners
    isochroneEl(this).cleanupMapInteractionListeners();

    // Clean up intersection observer
    if (isochroneEl(this).intersectionObserver) {
      isochroneEl(this).intersectionObserver.disconnect();
      isochroneEl(this).intersectionObserver = null;
    }

    isochroneEl(this).removeIsochrone();
    super.disconnectedCallback();
  }

  // Getters
}
