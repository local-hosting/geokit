/**
 * Composite API provider — capability fallback chains
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createCompositeAPIProvider } from '../src/providers/composite-provider';
import { MockAPIProvider } from '../../core/tests/mocks/mock-api-provider';
import { NYC } from '../../core/tests/fixtures/locations';

describe('CompositeAPIProvider', () => {
  let primary: MockAPIProvider;
  let fallback: MockAPIProvider;

  beforeEach(() => {
    primary = new MockAPIProvider(['geocoding']);
    fallback = new MockAPIProvider(['geocoding']);
  });

  it('returns the first provider result with features', async () => {
    primary.geocodeImpl = async () => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [NYC.lng, NYC.lat] },
          properties: {},
        },
      ],
    });
    fallback.geocodeImpl = async () => {
      throw new Error('fallback should not run');
    };

    const composite = createCompositeAPIProvider({
      name: 'composite:geocoding',
      chains: { geocoding: [primary, fallback] },
    });

    const result = await composite.geocode({ query: 'New York' });
    expect(result.features).toHaveLength(1);
  });

  it('falls back when the primary provider throws', async () => {
    primary.geocodeImpl = async () => {
      throw new Error('primary down');
    };
    fallback.geocodeImpl = async () => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [NYC.lng, NYC.lat] },
          properties: { label: 'fallback' },
        },
      ],
    });

    const composite = createCompositeAPIProvider({
      name: 'composite:geocoding',
      chains: { geocoding: [primary, fallback] },
    });

    const result = await composite.geocode({ query: 'New York' });
    expect(result.features[0]?.properties?.label).toBe('fallback');
  });

  it('falls back when the primary returns an empty feature collection', async () => {
    primary.geocodeImpl = async () => ({ type: 'FeatureCollection', features: [] });
    fallback.geocodeImpl = async () => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [NYC.lng, NYC.lat] },
          properties: {},
        },
      ],
    });

    const composite = createCompositeAPIProvider({
      name: 'composite:geocoding',
      chains: { geocoding: [primary, fallback] },
    });

    const result = await composite.geocode({ query: 'Nowhere' });
    expect(result.features).toHaveLength(1);
  });

  it('reverseGeocode falls back to the next provider', async () => {
    primary.reverseGeocodeImpl = async () => null;
    fallback.reverseGeocodeImpl = async ({ lat, lng }) => ({
      postcode: '10001',
      coordinates: [lng, lat],
    });

    const composite = createCompositeAPIProvider({
      name: 'composite:geocoding',
      chains: { geocoding: [primary, fallback] },
    });

    const result = await composite.reverseGeocode({ lat: NYC.lat, lng: NYC.lng });
    expect(result?.postcode).toBe('10001');
  });

  it('placeSearch falls back when primary returns no results', async () => {
    const primary = new MockAPIProvider(['placeSearch']);
    const fallback = new MockAPIProvider(['placeSearch']);
    primary.placeSearchImpl = async () => [];
    fallback.placeSearchImpl = async () => [
      { id: '1', name: 'Coffee Shop', location: [NYC.lng, NYC.lat] },
    ];

    const composite = createCompositeAPIProvider({
      name: 'composite:placeSearch',
      chains: { placeSearch: [primary, fallback] },
    });

    const results = await composite.placeSearch({ query: 'coffee', ll: [NYC.lng, NYC.lat] });
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Coffee Shop');
  });

  it('fetchIsochrone falls back when primary throws', async () => {
    const primary = new MockAPIProvider(['isochrone']);
    const fallback = new MockAPIProvider(['isochrone']);
    await primary.initialize({});
    await fallback.initialize({});
    primary.fetchIsochroneImpl = async () => {
      throw new Error('primary isochrone down');
    };
    fallback.fetchIsochroneImpl = async () => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [] },
          properties: { time: 15 },
        },
      ],
    });

    const composite = createCompositeAPIProvider({
      name: 'composite:isochrone',
      chains: { isochrone: [primary, fallback] },
    });

    const result = await composite.fetchIsochrone({
      lat: NYC.lat,
      lng: NYC.lng,
      minutes: [15],
      mode: 'driving',
    });
    expect(result.features).toHaveLength(1);
  });
});
