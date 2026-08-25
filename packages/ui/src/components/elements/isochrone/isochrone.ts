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


export { IsochroneElement } from './isochrone-static-factory.js';
