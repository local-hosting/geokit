/**
 * Geokit Point Component
 *
 * Creates simple geometric points/dots on the map for marking coordinates.
 * Optional glow: set glow or glow="true" for a halo behind the point (off by default). Use glow-color or leave unset to match the point color.
 * Visual states: hover (on mouseover), selected (ring + shadow; attribute `selected` or focus()/blur()).
 *
 * Usage:
 * <gk-point lat="40.7128" lng="-74.0060" color="#ff0000" size="8"></gk-point>
 * <gk-point lat="40.7128" lng="-74.0060" color="#ff0000" size="8" glow></gk-point>
 */

import { MapChildElement } from '../../map-child-element';
import {
  extractPointLngLat,
  normalizeCoordinatesArray,
  isValidCoordinate,
} from '@geokit/core/coordinates';
import type { MapEvent, MapRenderedFeature } from '../../../providers/types';
import { getCSSVariable, getCSSVariableNumber } from '../../../utils/theme';
import { createGeokitLogger } from '../../../utils/logger';
import { PopupElement } from '../popup/popup';
import { readFirstPointCoordinatesFromGeoJsonSource } from '../../../utils/geojson-source-options';
import { applyPointPaintProperties } from './point-style';
import { createPointLayers as createPointLayersFn, type PointMapLike } from './point-layers';
import {
  applySelectedVisual as applySelectedVisualFn,
  clearSelectedVisual,
} from './point-selection';

const { debug } = createGeokitLogger('point');

export interface PointOptions {
  lat: number;
  lng: number;
  color?: string;
  size?: number;
  opacity?: number;
  blur?: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  shadow?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOpacity?: number;
  /** When true, show a halo/glow behind the point (default: false). */
  glow?: boolean;
  /** Glow color; defaults to the point color when not set. */
  glowColor?: string;
  glowOpacity?: number;
  glowBlur?: number;
  pointId?: string;
  pointName?: string;
}


export { PointElement } from './point-static-factory.js';
