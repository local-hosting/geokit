/**
 * Point selection visual: ring + shadow layers (Single Responsibility)
 */

import { getCSSVariable, getCSSVariableNumber } from '../../../utils/theme';
import { getZoomRadiusExpression, getShadowRadiusExpression } from './point-style';

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
  feature: GeoJSON.Feature
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
    if (map.getSource?.(selectedSourceId)) {
      map.removeSource(selectedSourceId);
    }
    map.addSource(selectedSourceId, { type: 'geojson', data: selectedData });

    if (map.getLayer?.(selectedShadowLayerId)) map.removeLayer(selectedShadowLayerId);
    if (map.getLayer?.(selectedLayerId)) map.removeLayer(selectedLayerId);

    const selectedShadowColor = getCSSVariable(mapElement, '--gk-focus-shadow-color', '');
    const selectedRingColor = getCSSVariable(mapElement, '--gk-focus-ring-color', '');

    map.addLayer(
      {
        id: selectedShadowLayerId,
        type: 'circle',
        source: selectedSourceId,
        paint: {
          'circle-radius': getShadowRadiusExpression(size),
          'circle-color': selectedShadowColor,
          'circle-opacity': getCSSVariableNumber(mapElement, '--gk-point-glow-focus-opacity', 0),
          'circle-blur': 3,
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
          'circle-radius': getZoomRadiusExpression(size),
          'circle-color': 'transparent',
          'circle-opacity': 1,
          'circle-stroke-width': 2,
          'circle-stroke-color': selectedRingColor,
          'circle-stroke-opacity': 1,
        },
      },
      layerId
    );

    return {
      layerId: selectedLayerId,
      shadowLayerId: selectedShadowLayerId,
      sourceId: selectedSourceId,
    };
  } catch (error) {
    console.error('[Point] Error applying selected visual:', error);
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
