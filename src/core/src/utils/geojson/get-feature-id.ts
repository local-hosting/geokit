import type { Feature } from '../../types';

/**
 * Extract feature ID from a GeoJSON feature
 * Checks multiple common ID property names in order of preference
 *
 * @param feature - GeoJSON Feature
 * @param idProperties - Optional array of property names to check (default: ['id', 'slug'])
 * @returns Feature ID as string, or null if not found
 *
 * @example
 * ```typescript
 * const feature = { type: 'Feature', properties: { id: '123', name: 'Location' } };
 * getFeatureId(feature); // '123'
 *
 * const feature2 = { type: 'Feature', properties: { slug: 'location-1' } };
 * getFeatureId(feature2); // 'location-1'
 *
 * // Custom ID properties
 * getFeatureId(feature, ['customId', 'id']); // Checks customId first, then id
 * ```
 */
export function getFeatureId(
  feature: Feature,
  idProperties: string[] = ['id', 'slug']
): string | null {
  if (!feature) return null;

  if (feature.properties) {
    for (const prop of idProperties) {
      const value = feature.properties[prop];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value);
      }
    }
  }

  if (feature.id !== undefined && feature.id !== null && String(feature.id).trim() !== '') {
    return String(feature.id);
  }

  return null;
}
