import { describe, expect, it } from 'vitest';
import {
  enrichPlaceSearchResult,
  resolvePlaceSearchCategories,
  setPlaceTaxonomyResolver,
} from '../../../src/api/place-taxonomy.js';
import { createGeokitTaxonomyResolver } from '@geokit/geotypes/geokit';

describe('place-taxonomy', () => {
  it('requires resolver when geotypes are passed', () => {
    setPlaceTaxonomyResolver(null);
    expect(() =>
      resolvePlaceSearchCategories({ geotypes: ['RSE'], ll: [0, 0] }, 'foursquare')
    ).toThrow(/setPlaceTaxonomyResolver/);
  });

  it('resolves geotypes to provider categories', () => {
    setPlaceTaxonomyResolver(createGeokitTaxonomyResolver());
    const categories = resolvePlaceSearchCategories({ geotypes: ['RSE'] }, 'foursquare');
    expect(categories?.length).toBeGreaterThan(0);
    setPlaceTaxonomyResolver(null);
  });

  it('enriches search results with geotype fields', () => {
    setPlaceTaxonomyResolver(createGeokitTaxonomyResolver());
    const enriched = enrichPlaceSearchResult(
      {
        id: '1',
        name: 'Test',
        location: [0, 0],
        categories: ['4bf58dd8d48988d122951735'],
      },
      'foursquare'
    );
    expect(enriched.geotype).toBe('electronics_store');
    expect(enriched.geotypeAcronym).toBe('RSE');
    setPlaceTaxonomyResolver(null);
  });
});
