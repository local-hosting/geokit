import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EsriPlacesService,
  buildEsriNearPointUrl,
  normalizeEsriPlace,
} from '../src/esri-places-service';

describe('@twinfile/geokit/esri', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });


  it('normalizes esri place items', () => {
    const result = normalizeEsriPlace({
      placeId: 'esri:place:1',
      name: 'Tech World',
      location: { x: -86.78, y: 36.16 },
      categories: [{ categoryId: '4bf58dd8d48988d122951735', label: 'Electronics Store' }],
      distance: 90,
    });
    expect(result).toMatchObject({
      id: 'esri:place:1',
      name: 'Tech World',
      location: [-86.78, 36.16],
      categories: ['4bf58dd8d48988d122951735'],
      distance: 90,
    });
  });

});
