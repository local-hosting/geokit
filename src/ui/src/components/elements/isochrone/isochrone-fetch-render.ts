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
import { getServiceForCapability } from '@twinfile/geokit/service/registry';
import { debug } from '../../../utils/logger';
import { getCSSVariable, getCSSVariableNumber } from '../../../utils/theme';
import { getIsochroneCacheKey } from './isochrone-fetch';
import {
  buildChoroplethFillPaint,
  FLAT_CHOROPLETH_FILL_ANTIALIAS_OPTIONS,
  type FillAntialiasMap,
} from '../../../utils/choropleth-fill-paint';

import { isochroneEl } from './isochrone-el';
import { prepareIsochroneDisplayData } from './isochrone-render-pipeline';
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

import { IsochroneBase } from './isochrone-base';

export class IsochroneFetchRender extends IsochroneBase {
  protected async fetchAndRenderIsochrone(): Promise<void> {
    if (!isochroneEl(this).map) return;
    if (!isochroneEl(this).visible) return;

    // Ensure IDs are initialized (in case connectedCallback hasn't completed)
    if (!isochroneEl(this).sourceId) {
      const stableId = isochroneEl(this).getAttribute('source-id');
      if (stableId) {
        isochroneEl(this).sourceId = stableId;
        isochroneEl(this).fillLayerId = `polygon-fill-${stableId}`;
        isochroneEl(this).lineLayerId = `polygon-stroke-${stableId}`;
      } else {
        const uuid = crypto.randomUUID();
        isochroneEl(this).sourceId = `isochrone-${uuid}`;
        isochroneEl(this).fillLayerId = `polygon-fill-isochrone-${uuid}`;
        isochroneEl(this).lineLayerId = `polygon-stroke-isochrone-${uuid}`;
      }
    }

    const lat = parseFloat(isochroneEl(this).getAttribute('lat') || '');
    const lng = parseFloat(isochroneEl(this).getAttribute('lng') || '');

    const time = isochroneEl(this).time;
    const mode = isochroneEl(this).mode;

    if (isNaN(lat) || isNaN(lng)) {
      console.warn('[gk-isochrone] Invalid coordinates:', { lat, lng });
      return;
    }

    // Check if stored data matches current settings
    // Stored data is tagged with the time/mode it was set for
    const storedData = isochroneEl(this).storedData;
    const storedDataTime = (this as any)._storedDataTime;
    const storedDataMode = (this as any)._storedDataMode;
    const canUseStoredData =
      storedData !== null && storedDataTime === time && storedDataMode === mode;

    const cacheKey = getIsochroneCacheKey(lat, lng, time, mode, canUseStoredData);
    if (cacheKey === isochroneEl(this).currentCacheKey) {
      return;
    }

    let result: GeoJSON.FeatureCollection | null = null;

    if (canUseStoredData) {
      // Use pre-computed data - skip API fetch (settings match what was stored)
      result = storedData;
    } else {
      // Get API provider that supports isochrone (optional when app uses stored data only)
      const provider = getServiceForCapability('isochrone');
      if (!provider) {
        isochroneEl(this).dispatchEvent(
          new CustomEvent('isochrone-error', {
            detail: {
              error: new Error('No isochrone provider configured'),
              lat,
              lng,
              time,
              mode,
              element: this,
            },
            bubbles: true,
          })
        );
        return;
      }

      try {
        // Fetch isochrone data from API
        result = (await provider.fetchIsochrone?.({
          lat,
          lng,
          minutes: [time],
          mode,
        })) as GeoJSON.FeatureCollection | null;
      } catch (error) {
        const errorMsg = `[gk-isochrone] ✗ Failed to fetch isochrone for ${lat.toFixed(6)},${lng.toFixed(6)}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg, error);
        isochroneEl(this).dispatchEvent(
          new CustomEvent('isochrone-error', {
            detail: {
              error,
              lat,
              lng,
              time,
              mode,
              element: this,
            },
            bubbles: true,
          })
        );
        return;
      }
    }

    try {
      // Raw API polygon (events / optional legacy H3 upgrade path)
      (this as any)._originalIsochroneData = result;

      if (!result || !result.features || result.features.length === 0) {
        debug.warn(`[gk-isochrone] No features returned for ${lat.toFixed(6)},${lng.toFixed(6)}`);
        isochroneEl(this).dispatchEvent(
          new CustomEvent('isochrone-error', {
            detail: {
              error: new Error('No features returned from API'),
              lat,
              lng,
              time,
              mode,
              element: this,
            },
            bubbles: true,
          })
        );
        return;
      }

      const self = isochroneEl(this);
      if (self.render === 'h3') {
        self.hasUpgradedResolution = false;
      }
      const processedData = await prepareIsochroneDisplayData({
        result,
        render: self.render,
        h3Resolution: self.h3Resolution,
        color: self.color,
        opacity: self.opacity,
      });
      if (self.render === 'h3') {
        self.hasUpgradedResolution = true;
      }

      // Ensure IDs exist (generated once per element lifetime)
      if (!isochroneEl(this).sourceId) {
        const stableId = isochroneEl(this).getAttribute('source-id');
        if (stableId) {
          isochroneEl(this).sourceId = stableId;
          isochroneEl(this).fillLayerId = `polygon-fill-${stableId}`;
          isochroneEl(this).lineLayerId = `polygon-stroke-${stableId}`;
        } else {
          const uuid = crypto.randomUUID();
          isochroneEl(this).sourceId = `isochrone-${uuid}`;
          isochroneEl(this).fillLayerId = `polygon-fill-isochrone-${uuid}`;
          isochroneEl(this).lineLayerId = `polygon-stroke-isochrone-${uuid}`;
        }
      }

      if (!isochroneEl(this).map) return;

      // Reuse existing source if it exists — just update data in place (no layer add/remove).
      // This avoids triggering MapLibre style recalculation which can cause other layers to
      // partially vanish. Layers are created only once; subsequent renders just swap the data.
      const existingSource = isochroneEl(this).map.getSource?.(isochroneEl(this).sourceId) as
        | { setData?: (data: unknown) => void }
        | undefined;

      if (existingSource && typeof existingSource.setData === 'function') {
        existingSource.setData(processedData);

        // Update paint properties in case color/opacity/stroke changed
        try {
          if (isochroneEl(this).fillLayerId && isochroneEl(this).map.getLayer?.(isochroneEl(this).fillLayerId)) {
            const fillId = isochroneEl(this).fillLayerId;
            const fillPaint = buildChoroplethFillPaint(
              isochroneEl(this).map as FillAntialiasMap,
              {
                'fill-color': isochroneEl(this).color,
                'fill-opacity': isochroneEl(this).opacity,
                'fill-outline-color': 'transparent',
              },
              FLAT_CHOROPLETH_FILL_ANTIALIAS_OPTIONS,
            );
            for (const [key, value] of Object.entries(fillPaint)) {
              isochroneEl(this).map.setPaintProperty?.(fillId, key, value);
            }
          }
          if (isochroneEl(this).lineLayerId && isochroneEl(this).map.getLayer?.(isochroneEl(this).lineLayerId)) {
            isochroneEl(this).map.setPaintProperty?.(isochroneEl(this).lineLayerId, 'line-color', isochroneEl(this).strokeColor);
            isochroneEl(this).map.setPaintProperty?.(isochroneEl(this).lineLayerId, 'line-width', isochroneEl(this).strokeWidth);
          }
        } catch (paintErr) {
          debug.warn('[gk-isochrone] setPaintProperty failed', paintErr);
        }
      } else {
        // First render: create source + layers once
        // Find the layer to insert before (consumer `before-layer` or first circle layer)
        const beforeLayerId = isochroneEl(this).findBeforeLayer();

        isochroneEl(this).map.addSource(isochroneEl(this).sourceId, {
          type: 'geojson',
          data: processedData,
        });

        // Add fill layer (above polygons, below points). Do not pass undefined as second arg (MapTiler coalesceChanges).
        if (isochroneEl(this).fillLayerId) {
          const fillSpec = {
            id: isochroneEl(this).fillLayerId,
            type: 'fill',
            source: isochroneEl(this).sourceId,
            paint: buildChoroplethFillPaint(
              isochroneEl(this).map as FillAntialiasMap,
              {
                'fill-color': isochroneEl(this).color,
                'fill-opacity': isochroneEl(this).opacity,
                'fill-outline-color': 'transparent',
              },
              FLAT_CHOROPLETH_FILL_ANTIALIAS_OPTIONS,
            ),
          };
          if (beforeLayerId != null) {
            isochroneEl(this).map.addLayer(fillSpec, beforeLayerId);
          } else {
            isochroneEl(this).map.addLayer(fillSpec);
          }
        }

        // Add line layer (above polygons, below points) - skip for H3 rendering to avoid stroke on hexagons
        if (isochroneEl(this).lineLayerId && isochroneEl(this).strokeWidth > 0 && isochroneEl(this).render !== 'h3') {
          const lineSpec = {
            id: isochroneEl(this).lineLayerId,
            type: 'line',
            source: isochroneEl(this).sourceId,
            paint: {
              'line-color': isochroneEl(this).strokeColor,
              'line-width': isochroneEl(this).strokeWidth,
              'line-blur': 1, // Soften edges
            },
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
          };
          if (beforeLayerId != null) {
            isochroneEl(this).map.addLayer(lineSpec, beforeLayerId);
          } else {
            isochroneEl(this).map.addLayer(lineSpec);
          }
        }

        // Setup hover handlers on the fill layer
        isochroneEl(this).setupHoverHandlers();

        // If consumer specified a before-layer, ensure ordering after addLayer
        // (addLayer already used beforeLayerId, but moveLayer handles edge cases
        //  where the reference layer was added after the initial addLayer call).
        const moveTarget = isochroneEl(this).beforeLayer;
        if (moveTarget && isochroneEl(this).map.moveLayer && isochroneEl(this).map.getLayer?.(moveTarget)) {
          try {
            if (isochroneEl(this).lineLayerId && isochroneEl(this).map.getLayer?.(isochroneEl(this).lineLayerId)) {
              isochroneEl(this).map.moveLayer(isochroneEl(this).lineLayerId, moveTarget);
            }
            if (isochroneEl(this).fillLayerId && isochroneEl(this).map.getLayer?.(isochroneEl(this).fillLayerId)) {
              isochroneEl(this).map.moveLayer(isochroneEl(this).fillLayerId, moveTarget);
            }
          } catch (err) {
            debug.warn('[gk-isochrone] moveLayer failed', { moveTarget, err });
          }
        }
      }

      // Mark successful render so duplicate fetches short-circuit until inputs change.
      isochroneEl(this).currentCacheKey = cacheKey;

      // Dispatch event immediately after we have the data
      // This allows demographics to start calculating concurrently with map rendering
      // Demographics only need the polygon geometry, not the visual rendering
      isochroneEl(this).dispatchEvent(
        new CustomEvent('isochrone-loaded', {
          detail: { lat, lng, time, mode, data: result, element: this },
          bubbles: true,
        })
      );
    } catch (error) {
      const errorMsg = `[gk-isochrone] ✗ Failed to fetch isochrone for ${lat.toFixed(6)},${lng.toFixed(6)}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg, error);
      isochroneEl(this).dispatchEvent(
        new CustomEvent('isochrone-error', {
          detail: {
            error,
            lat,
            lng,
            time,
            mode,
            element: this,
          },
          bubbles: true,
        })
      );
    }
  }

  /**
   * Clean up existing layers from map without clearing IDs
   * Used when re-rendering isochrone with new data
   */
}
