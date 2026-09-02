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
} from '@twinfile/geokit/core/coordinates';
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

import { PointAccessorsApi } from './point-accessors-api';

export class PointElement extends PointAccessorsApi {
  static create(options: PointOptions): PointElement {
    const point = document.createElement('gk-point') as PointElement;

    // Store options to set as attributes when element is connected to DOM
    // This avoids JSDOM/Happy-DOM limitations where attributes can't be set before connection
    (point as any)._createOptions = options;

    return point;
  }

  /**
   * Create multiple point elements from GeoJSON FeatureCollection
   * @param geojson - GeoJSON FeatureCollection with Point features
   * @param options - Optional styling and behavior options
   * @returns Array of configured point elements
   */
  static createFromGeoJSON(
    geojson: GeoJSON.FeatureCollection,
    options: {
      color?: string;
      /** Property name to read color from each feature (takes precedence over color option) */
      colorProperty?: string;
      size?: number;
      opacity?: number;
      blur?: number;
      shadow?: boolean;
      shadowColor?: string;
      shadowBlur?: number;
      shadowOpacity?: number;
      glow?: boolean;
      glowColor?: string;
      glowOpacity?: number;
      glowBlur?: number;
      strokeWidth?: number;
      strokeColor?: string;
      idProperty?: string;
      nameProperty?: string;
    } = {}
  ): PointElement[] {
    // Read defaults from CSS variables (falls back to hardcoded if not set)
    const cssPointColor = getCSSVariable(document.documentElement, '--gk-point-color', '');
    const cssPointStroke = getCSSVariable(document.documentElement, '--gk-point-stroke-color', '');
    const cssPointShadow = getCSSVariable(document.documentElement, '--gk-point-shadow-color', '');
    const cssGlowOpacity = getCSSVariableNumber(
      document.documentElement,
      '--gk-point-glow-opacity',
      0
    );

    const {
      color: defaultColor = cssPointColor,
      colorProperty,
      size = 8,
      opacity = 1,
      blur = 0,
      shadow = true,
      shadowColor = cssPointShadow,
      shadowBlur = 1,
      shadowOpacity = cssGlowOpacity,
      glow = false,
      glowColor,
      glowOpacity = cssGlowOpacity,
      glowBlur = getCSSVariableNumber(document.documentElement, '--gk-glow-blur', 0),
      strokeWidth = 0,
      strokeColor = cssPointStroke,
      idProperty = 'id',
      nameProperty = 'name',
    } = options;

    const points: PointElement[] = [];

    geojson.features.forEach((feature) => {
      if (feature.geometry.type !== 'Point') {
        console.warn('[gk-point] Skipping non-Point feature:', feature);
        return;
      }

      const [lng, lat] = feature.geometry.coordinates;

      // Get color from feature property if colorProperty is specified, otherwise use default
      const featureColor =
        colorProperty && feature.properties?.[colorProperty]
          ? String(feature.properties[colorProperty])
          : defaultColor;

      const point = PointElement.create({
        lat,
        lng,
        color: featureColor,
        size,
        opacity,
        blur,
        shadow,
        shadowColor,
        shadowBlur,
        shadowOpacity,
        glow,
        glowColor,
        glowOpacity,
        glowBlur,
        strokeWidth,
        strokeColor,
        pointId: feature.properties?.[idProperty]
          ? String(feature.properties[idProperty])
          : undefined,
        pointName: feature.properties?.[nameProperty]
          ? String(feature.properties[nameProperty])
          : undefined,
      });

      // Store all properties for app use (as property to avoid JSDOM issues)
      if (feature.properties) {
        (point as any)._dataProperties = feature.properties;
      }

      points.push(point);
    });

    return points;
  }
}

// Register the custom element
if (!customElements.get('gk-point')) {
  customElements.define('gk-point', PointElement);
}

