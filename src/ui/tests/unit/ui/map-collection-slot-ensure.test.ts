import { describe, expect, it } from 'vitest';
import {
  resolveSlotEnsureOptions,
  slotHasBasemapCredentials,
} from '../../../src/components/elements/map-collection/resolve-slot-ensure-options';

describe('resolveSlotEnsureOptions', () => {
  it('preserves an explicit child provider and does not inject maptiler api-key on mapbox slots', () => {
    expect(
      resolveSlotEnsureOptions({
        existingProvider: 'mapbox',
        collectionApiKey: 'mt-key-from-collection',
        mapStyle: null,
        minZoom: 2,
        maxZoom: 18,
        mapboxConfig: { accessToken: 'pk.test' },
        maptilerConfig: { apiKey: 'mt-key' },
      }),
    ).toEqual({
      provider: 'mapbox',
      accessToken: 'pk.test',
      minZoom: 2,
      maxZoom: 18,
    });
  });

  it('defaults to mapbox when bootstrap configured mapbox and child has no provider', () => {
    expect(
      resolveSlotEnsureOptions({
        existingProvider: null,
        collectionApiKey: 'mt-key',
        mapStyle: 'streets',
        minZoom: null,
        maxZoom: null,
        mapboxConfig: { accessToken: 'pk.test' },
        maptilerConfig: { apiKey: 'mt-key' },
      }),
    ).toMatchObject({
      provider: 'mapbox',
      accessToken: 'pk.test',
      mapStyle: 'streets',
    });
  });

  it('prefers collection access-token over registry for mapbox slots', () => {
    expect(
      resolveSlotEnsureOptions({
        existingProvider: null,
        collectionProvider: 'mapbox',
        collectionAccessToken: 'pk.collection',
        collectionApiKey: null,
        mapStyle: null,
        minZoom: null,
        maxZoom: null,
        mapboxConfig: { accessToken: 'pk.registry' },
      }),
    ).toMatchObject({
      provider: 'mapbox',
      accessToken: 'pk.collection',
    });
  });

  it('slotHasBasemapCredentials is false until token is available', () => {
    expect(
      slotHasBasemapCredentials({
        slotProvider: 'mapbox',
        slotAccessToken: null,
        slotApiKey: null,
        collectionProvider: 'mapbox',
        collectionAccessToken: null,
        collectionApiKey: null,
        mapboxConfig: undefined,
      }),
    ).toBe(false);
    expect(
      slotHasBasemapCredentials({
        slotProvider: 'mapbox',
        slotAccessToken: null,
        slotApiKey: null,
        collectionProvider: 'mapbox',
        collectionAccessToken: 'pk.test',
        collectionApiKey: null,
      }),
    ).toBe(true);
  });

  it('falls back to maptiler when only maptiler is configured', () => {
    expect(
      resolveSlotEnsureOptions({
        existingProvider: null,
        collectionApiKey: 'mt-fallback',
        mapStyle: null,
        minZoom: null,
        maxZoom: null,
        maptilerConfig: { apiKey: 'mt-key' },
      }),
    ).toMatchObject({
      provider: 'maptiler',
      apiKey: 'mt-fallback',
    });
  });
});