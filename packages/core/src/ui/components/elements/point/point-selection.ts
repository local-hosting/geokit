/**
 * Point selection visual: ring + shadow layers (Single Responsibility)
 */

import { getCSSVariable, getCSSVariableNumber } from '../../../utils/theme';
import { POINT_GEOJSON_SOURCE_OPTIONS } from '../../../utils/geojson-source-options';
import {
  getHoverGlowRadiusExpression,
  getSelectionRingRadiusExpression,
  POINT_SELECTION_RING_STROKE_WIDTH,
} from './point-style';

export interface ApplySelectedVisualOptions {
  /** Match focus halo to the point fill (defaults to --gk-focus-shadow-color). */
  pointColor?: string;
  /** Point outline width (px); ring sits outside this edge. */
  strokeWidth?: number;
}

export interface SelectedLayers {
  layerId: string;
  shadowLayerId: string;
  sourceId: string;
}

/** Minimal map interface for selection layer add/remove; MapInstance is cast at call site. */
export type PointSelectionMapLike = {
  getSource?: (id: string) => unknown;
  getLayer?: (id: string) => unknown;
  addSource: (id: string, spec: { type: string; data: GeoJSON.FeatureCollection }) => void;
  removeSource: (id: string) => void;
  addLayer: (spec: object, beforeId?: string) => void;
  removeLayer: (id: string) => void;
};

/**
 * Add selected-state source and layers (ring + shadow). Caller must clear existing selection first.
 * Returns the selected layer ids/source to store, or null on error.
 */
export function applySelectedVisual(
  map: PointSelectionMapLike | null,
  layerId: string,
  sourceId: string,
  size: number,
  mapElement: HTMLElement,
  feature: GeoJSON.Feature,
  options: ApplySelectedVisualOptions = {}
): SelectedLayers | null {
  if (!map?.addSource || !map?.addLayer) return null;

  const selectedLayerId = `${layerId}-selected`;
  const selectedShadowLayerId = `${layerId}-selected-shadow`;
  const selectedSourceId = `${sourceId}-selected`;

  const selectedData: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [JSON.parse(JSON.stringify(feature))],
  };

  try {
    if (map.getLayer?.(selectedShadowLayerId)) map.removeLayer(selectedShadowLayerId);
    if (map.getLayer?.(selectedLayerId)) map.removeLayer(selectedLayerId);
    if (map.getSource?.(selectedSourceId)) {
      map.removeSource(selectedSourceId);
    }

    map.addSource(selectedSourceId, {
      type: 'geojson',
      data: selectedData,
      ...POINT_GEOJSON_SOURCE_OPTIONS,
    });

    const selectedShadowColor = getCSSVariable(
      mapElement,
      '--gk-focus-shadow-color',
      'rgba(0, 0, 0, 0.4)'
    );
    const selectedRingColor = getCSSVariable(mapElement, '--gk-focus-ring-color', '#ffffff');
    const focusHaloColor = options.pointColor || selectedShadowColor;
    const focusHaloBlur = getCSSVariableNumber(mapElement, '--gk-glow-blur', 0.5);
    const focusHaloOpacity = getCSSVariableNumber(mapElement, '--gk-point-glow-focus-opacity', 0.4);

    map.addLayer(
      {
        id: selectedShadowLayerId,
        type: 'circle',
        source: selectedSourceId,
        paint: {
          'circle-radius': getHoverGlowRadiusExpression(size),
          'circle-color': focusHaloColor,
          'circle-opacity': focusHaloOpacity,
          'circle-blur': focusHaloBlur,
          'circle-stroke-width': 0,
        },
      },
      layerId
    );

    map.addLayer(
      {
        id: selectedLayerId,
        type: 'circle',
        source: selectedSourceId,
        paint: {
          'circle-radius': getSelectionRingRadiusExpression(size, options.strokeWidth ?? 0),
          'circle-color': 'rgba(0,0,0,0)',
          'circle-opacity': 1,
          'circle-stroke-width': POINT_SELECTION_RING_STROKE_WIDTH,
          'circle-stroke-color': selectedRingColor,
          'circle-stroke-opacity': 1,
        },
      },
      layerId
    );

    const moveLayer = (map as { moveLayer?: (id: string) => void }).moveLayer;
    if (moveLayer) {
      try {
        moveLayer(selectedLayerId);
      } catch {
        /* ring z-order best-effort */
      }
    }

    return {
      layerId: selectedLayerId,
      shadowLayerId: selectedShadowLayerId,
      sourceId: selectedSourceId,
    };
  } catch (error) {
    console.error('[gk-point] Error applying selected visual:', error);
    return null;
  }
}

/**
 * Remove selection layers and source. Safe to call with null selectedLayers.
 */
export function clearSelectedVisual(
  map: PointSelectionMapLike | null,
  selectedLayers: SelectedLayers | null
): void {
  if (!map || !selectedLayers) return;
  const { layerId, shadowLayerId, sourceId } = selectedLayers;
  if (map.getLayer?.(layerId)) map.removeLayer(layerId);
  if (map.getLayer?.(shadowLayerId)) map.removeLayer(shadowLayerId);
  if (map.getSource?.(sourceId)) map.removeSource(sourceId);
}
