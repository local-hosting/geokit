import type { Feature, Bounds } from '../types';
import { getBounds } from '../utils/bounds';

export function boundsFromFeature(feature: Feature | GeoJSON.Feature): Bounds | null {
  if (!feature?.geometry) return null;
  return getBounds([feature as Feature]);
}

export function boundsFromFeatures(features: GeoJSON.Feature[]): Bounds | null {
  if (!features.length) return null;
  return getBounds({ type: 'FeatureCollection', features });
}
