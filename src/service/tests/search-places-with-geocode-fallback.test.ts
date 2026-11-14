import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  ensurePlaceSearchRouterReady,
  ensureGeocodingRouterReady,
  getServiceForCapability,
  placeSearch,
  geocode,
} = vi.hoisted(() => ({
  ensurePlaceSearchRouterReady: vi.fn(async () => undefined),
  ensureGeocodingRouterReady: vi.fn(async () => undefined),
  getServiceForCapability: vi.fn(),
  placeSearch: vi.fn(),
  geocode: vi.fn(),
}));

vi.mock('../src/builtins', () => ({
  ensurePlaceSearchRouterReady,
  ensureGeocodingRouterReady,
}));

vi.mock('../src/services/registry', () => ({
  getServiceForCapability,
}));

import { searchPlacesWithGeocodeFallback } from '../src/search-places-with-geocode-fallback';

describe('searchPlacesWithGeocodeFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServiceForCapability.mockImplementation((cap: string) => {
      if (cap === 'placeSearch') return { placeSearch };
      if (cap === 'geocoding') return { geocode };
      return null;
    });
  });

  it('returns [] for blank queries without touching routers', async () => {
    await expect(searchPlacesWithGeocodeFallback({ query: '  ' })).resolves.toEqual([]);
    expect(ensurePlaceSearchRouterReady).not.toHaveBeenCalled();
  });

  it('returns venue rows when placeSearch has hits', async () => {
    placeSearch.mockResolvedValue([
      { id: 'fsq:1', name: 'Central Market', location: [-97.74, 30.26] },
    ]);

    const results = await searchPlacesWithGeocodeFallback({
      query: '  market ',
      placeSearch: { foursquareApiKey: 'fsq' },
    });

    expect(ensurePlaceSearchRouterReady).toHaveBeenCalledWith({ foursquareApiKey: 'fsq' });
    expect(placeSearch).toHaveBeenCalledWith({
      query: 'market',
      ll: undefined,
      limit: 8,
      sort: 'RELEVANCE',
    });
    expect(ensureGeocodingRouterReady).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
  });

  it('falls back to geocode when venue search is empty', async () => {
    placeSearch.mockResolvedValue([]);
    geocode.mockResolvedValue({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'boston',
          geometry: { type: 'Point', coordinates: [-71.06, 42.36] },
          properties: {
            name: 'Boston',
            place_name: 'Boston, Massachusetts, United States',
          },
        },
      ],
    });

    const results = await searchPlacesWithGeocodeFallback({
      query: 'Boston',
      placeSearch: { foursquareApiKey: 'fsq' },
      maptilerApiKey: 'mt',
    });

    expect(ensureGeocodingRouterReady).toHaveBeenCalledWith({ maptilerApiKey: 'mt' });
    expect(geocode).toHaveBeenCalledWith({
      query: 'Boston',
      limit: 8,
      proximity: undefined,
    });
    expect(results).toEqual([
      {
        id: 'boston',
        name: 'Boston',
        address: 'Boston, Massachusetts, United States',
        location: [-71.06, 42.36],
      },
    ]);
  });

  it('returns [] when venues empty and no maptiler key', async () => {
    placeSearch.mockResolvedValue([]);
    await expect(
      searchPlacesWithGeocodeFallback({
        query: 'Boston',
        placeSearch: { foursquareApiKey: 'fsq' },
      }),
    ).resolves.toEqual([]);
    expect(ensureGeocodingRouterReady).not.toHaveBeenCalled();
  });

  it('throws when placeSearch capability is missing', async () => {
    getServiceForCapability.mockReturnValue(null);
    await expect(
      searchPlacesWithGeocodeFallback({
        query: 'coffee',
        placeSearch: { foursquareApiKey: 'fsq' },
      }),
    ).rejects.toThrow('Place search is not configured');
  });
});
