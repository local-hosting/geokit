import { getCSSVariable, getCSSVariableNumber } from '../../../utils/theme';
import type { PointSelectRuntime } from './point-select-runtime';

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
  glow?: boolean;
  glowColor?: string;
  glowOpacity?: number;
  glowBlur?: number;
  pointId?: string;
  pointName?: string;
}

export type PointCreateFromGeoJsonOptions = {
  color?: string;
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
};

type PointElementCtor = typeof PointSelectRuntime & {
  create(options: PointOptions): HTMLElement;
  createFromGeoJSON(
    geojson: GeoJSON.FeatureCollection,
    options?: PointCreateFromGeoJsonOptions,
  ): HTMLElement[];
};

export function installPointFactoryStatics<T extends typeof PointSelectRuntime>(
  PointClass: T,
): PointElementCtor {
  const ctor = PointClass as unknown as PointElementCtor;
  ctor.create = function create(options: PointOptions) {
    const point = document.createElement('gk-point');
    (point as HTMLElement & { _createOptions?: PointOptions })._createOptions = options;
    return point;
  };

  ctor.createFromGeoJSON = function createFromGeoJSON(
    geojson: GeoJSON.FeatureCollection,
    options: PointCreateFromGeoJsonOptions = {},
  ) {
    const cssPointColor = getCSSVariable(document.documentElement, '--gk-point-color', '');
    const cssPointStroke = getCSSVariable(document.documentElement, '--gk-point-stroke-color', '');
    const cssPointShadow = getCSSVariable(document.documentElement, '--gk-point-shadow-color', '');
    const cssGlowOpacity = getCSSVariableNumber(
      document.documentElement,
      '--gk-point-glow-opacity',
      0,
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

    const points: HTMLElement[] = [];

    geojson.features.forEach((feature) => {
      if (feature.geometry.type !== 'Point') {
        console.warn('[gk-point] Skipping non-Point feature:', feature);
        return;
      }

      const [lng, lat] = feature.geometry.coordinates;
      const featureColor =
        colorProperty && feature.properties?.[colorProperty]
          ? String(feature.properties[colorProperty])
          : defaultColor;

      const point = ctor.create({
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

      if (feature.properties) {
        (point as HTMLElement & { _dataProperties?: Record<string, unknown> })._dataProperties =
          feature.properties;
      }

      points.push(point);
    });

    return points;
  };

  return ctor;
}