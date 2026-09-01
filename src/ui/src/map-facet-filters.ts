/**
 * Generic MapLibre facet filter expression builders.
 */

export interface FacetFilterConfig {
  /** Property path in GeoJSON feature (e.g., 'brand', 'cohortType', 'region') */
  property: string;
  /** Selected values from the facet (empty array = all selected = no filter) */
  selectedValues: string[];
  /** Optional: value to use when property is missing (e.g., 'retail' for brand, 'Other' for cohort) */
  defaultValue?: string;
  /** Optional: transform values before comparison (e.g., lowercase for region) */
  normalize?: boolean;
  /** Optional: additional value mappings (e.g., 'great lakes' -> 'great-lakes') */
  valueMappings?: Record<string, string[]>;
}

/**
 * Build a generic MapLibre filter expression for any facet
 *
 * @param config - Configuration for the facet filter
 * @returns MapLibre filter expression, or null if no filter should be applied
 *
 * Example:
 *   buildFacetFilterExpression({
 *     property: 'brand',
 *     selectedValues: ['retail', 'brand-b'],
 *   })
 *   // Returns: ['in', ['coalesce', ['get', 'brand'], ''], ['literal', ['retail', 'brand-b']]]
 */
export function buildFacetFilterExpression(
  config: FacetFilterConfig
): any[] | null {
  const { property, selectedValues, defaultValue, normalize, valueMappings } =
    config;

  // Empty selection = all selected = no filter
  if (selectedValues.length === 0) {
    return null;
  }

  // Build conditions
  const conditions: any[] = [];

  // Get expression for property value (coalesce avoids Safari/MapLibre "unknown feature value")
  const propertyExpr = normalize
    ? ['downcase', ['coalesce', ['get', property], '']]
    : ['coalesce', ['get', property], ''];

  // Handle default value (when property is missing)
  if (defaultValue && selectedValues.includes(defaultValue)) {
    // Include features where property doesn't exist (they get the default)
    conditions.push(['!', ['has', property]]);
  }

  // Build value matching conditions
  if (selectedValues.length === 1 && !valueMappings) {
    // Single value, simple equality
    const value = normalize
      ? selectedValues[0].toLowerCase()
      : selectedValues[0];
    conditions.push(['==', propertyExpr, value]);
  } else {
    // Multiple values or mappings - use 'in' or 'any'
    const allValues: string[] = [];

    for (const value of selectedValues) {
      const normalizedValue = normalize ? value.toLowerCase() : value;
      allValues.push(normalizedValue);

      // Add mapped variations if they exist
      if (valueMappings?.[normalizedValue]) {
        for (const mapping of valueMappings[normalizedValue]) {
          allValues.push(normalize ? mapping.toLowerCase() : mapping);
        }
      }
    }

    // Use 'in' for efficient multi-value matching
    conditions.push(['in', propertyExpr, ['literal', allValues]]);
  }

  // Combine conditions
  if (conditions.length === 0) {
    return null;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return ['any', ...conditions];
}

/**
 * Build a combined filter expression from multiple facet filters
 * All conditions are ANDed together (feature must match ALL facets)
 */
export function buildCombinedFacetFilterExpression(
  facetConfigs: FacetFilterConfig[]
): any[] {
  const conditions: any[] = [];

  for (const config of facetConfigs) {
    const filter = buildFacetFilterExpression(config);

    // If any facet returns false, the whole thing is false
    if (filter && filter[0] === 'literal' && filter[1] === false) {
      return ['literal', false];
    }

    if (filter) {
      conditions.push(filter);
    }
  }

  if (conditions.length === 0) {
    return ['literal', true]; // No filters = show all
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return ['all', ...conditions];
}
