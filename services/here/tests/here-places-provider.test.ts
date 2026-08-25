import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HerePlacesService,
  buildHereDiscoverUrl,
  normalizeHereDiscoverItem,
} from '../src/here-places-provider.js';

describe('@geokit/here', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPlaceTaxonomyResolver(createGeokitTaxonomyResolver());
  });


  it('normalizes discover items', () => {
    const result = normalizeHereDiscoverItem({
      id: 'here:poi:1',
      title: 'Tech World',
      position: { lat: 36.16, lng: -86.78 },
      address: { label: '123 Main St' },
      categories: [{ name: 'ELECTRONICS_STORE', primary: true }],
    });
    expect(result).toMatchObject({
      id: 'here:poi:1',
      name: 'Tech World',
      location: [-86.78, 36.16],
      categories: ['ELECTRONICS_STORE'],
    });
  });

});
