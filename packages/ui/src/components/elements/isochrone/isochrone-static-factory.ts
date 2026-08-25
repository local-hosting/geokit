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
import { convertToH3 } from './isochrone-h3';
import { getIsochroneCacheKey } from './isochrone-fetch';
import {
  buildChoroplethFillPaint,
  type FillAntialiasMap,
} from '../../../utils/choropleth-fill-paint';

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

import { IsochroneUpgrade } from './isochrone-upgrade.js';

export class IsochroneElement extends IsochroneUpgrade {
  get time(): number {
    return parseInt(this.getAttribute('time') || '15') || 15;
  }

  get mode(): 'driving' | 'walking' | 'cycling' {
    const mode = this.getAttribute('mode');
    if (mode === 'walking' || mode === 'cycling') return mode;
    return 'driving';
  }

  get color(): string {
    return (
      this.getAttribute('color') || getCSSVariable(this.mapElement, '--gk-isochrone-color', '')
    );
  }

  get opacity(): number {
    const attr = this.getAttribute('opacity');
    if (attr !== null && attr !== '') {
      const parsed = parseFloat(attr);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return getCSSVariableNumber(this.mapElement, '--gk-isochrone-opacity', 0.3);
  }

  get strokeColor(): string {
    return (
      this.getAttribute('stroke-color') ||
      getCSSVariable(this.mapElement, '--gk-isochrone-stroke-color', '')
    );
  }

  get strokeWidth(): number {
    const attr = this.getAttribute('stroke-width');
    if (attr === null) return 0; // Default to no stroke
    const parsed = parseFloat(attr);
    return isNaN(parsed) ? 0 : parsed;
  }

  get visible(): boolean {
    return this.getAttribute('visible') !== 'false';
  }

  /** Layer ID to insert isochrone layers before (consumer controls ordering). */
  get beforeLayer(): string | null {
    return this.getAttribute('before-layer');
  }

  get render(): 'polygon' | 'h3' {
    const render = this.getAttribute('render');
    return render === 'h3' ? 'h3' : 'polygon';
  }

  get h3Resolution(): number {
    const resolution = parseInt(this.getAttribute('h3-resolution') || '7');
    // Clamp to valid H3 resolution range (0-15)
    return Math.max(0, Math.min(15, resolution));
  }

  /**
   * Get pre-computed isochrone data from the 'data' attribute or setData() call
   * Returns null if not set or invalid JSON
   */
  get storedData(): GeoJSON.FeatureCollection | null {
    // Check for data set via setData() first (avoids JSON parsing overhead)
    const internalData = (this as any)._storedData;
    if (internalData) return internalData;

    // Fall back to data attribute
    const dataAttr = this.getAttribute('data');
    if (!dataAttr) return null;

    try {
      const parsed = JSON.parse(dataAttr);
      // Validate it looks like a FeatureCollection
      if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        return parsed as GeoJSON.FeatureCollection;
      }
      return null;
    } catch {
      debug.warn('[gk-isochrone] Invalid JSON in data attribute');
      return null;
    }
  }

  /**
   * Set pre-computed isochrone data programmatically
   * This avoids stringifying large JSON in attributes.
   * The data is tagged with the current time/mode so it's only used when settings match.
   */
  setData(data: GeoJSON.FeatureCollection | null): void {
    if (data) {
      // Store internally along with the time/mode it was set for
      // This allows us to reuse it later if the user switches back to these settings
      (this as any)._storedData = data;
      (this as any)._storedDataTime = this.time;
      (this as any)._storedDataMode = this.mode;
      this.currentCacheKey = null; // Force re-render
      this.waitForStyleLoaded(() => this.fetchAndRenderIsochrone());
    } else {
      delete (this as any)._storedData;
      delete (this as any)._storedDataTime;
      delete (this as any)._storedDataMode;
    }
  }

  // Public API
  async refresh(): Promise<void> {
    this.currentCacheKey = null; // Force refresh
    await this.waitForStyleLoaded(() => this.fetchAndRenderIsochrone());
  }

  show(): void {
    this.setAttribute('visible', 'true');
  }

  hide(): void {
    this.setAttribute('visible', 'false');
  }
}

// Register the custom element
if (!customElements.get('gk-isochrone')) {
  customElements.define('gk-isochrone', IsochroneElement);
}

