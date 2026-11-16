import { smoothFeatureCollection } from '@local-hosting/geokit/core';
import { convertIsochroneToH3 } from './isochrone-h3-load';

export type PrepareIsochroneDisplayDataInput = {
  result: GeoJSON.FeatureCollection;
  render: 'polygon' | 'h3';
  h3Resolution: number;
  color: string;
  opacity: number;
};

/** Map-ready geometry: smooth polygon or H3 cells only (no deferred polygon flash). */
export async function prepareIsochroneDisplayData(
  input: PrepareIsochroneDisplayDataInput
): Promise<GeoJSON.FeatureCollection> {
  const { result, render, h3Resolution, color, opacity } = input;
  if (render === 'h3') {
    return convertIsochroneToH3(result, h3Resolution, { color, opacity });
  }
  return smoothFeatureCollection(3)(result);
}