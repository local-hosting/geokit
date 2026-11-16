import { afterEach, describe, expect, it } from 'vitest';
import { MapLocalStore } from '@doppler-group/geokit/ui/storage/map-local-store';
import { resetGeoKitOfflineDBForTesting } from '@doppler-group/geokit/ui/storage/indexed-db';
import { MapOfflineDefaults } from '@doppler-group/geokit/core/contract/offline';

const camera = {
  center: { latitude: 40.75, longitude: -73.98 },
  zoom: 12,
  bearing: 0,
  pitch: 0,
};

afterEach(async () => {
  MapLocalStore.resetForTesting();
  await resetGeoKitOfflineDBForTesting();
  sessionStorage.clear();
});

describe('storage/map-local-store', () => {
  it('persists camera in memory scope', async () => {
    const store = MapLocalStore.getInstance();
    await store.patchLocalState('map-a', { cameraFrame: camera }, 'memory');
    const loaded = await store.getLocalState('map-a', 'memory');
    expect(loaded?.cameraFrame).toEqual(camera);
  });

  it('persists selected pin in session scope', async () => {
    const store = MapLocalStore.getInstance();
    await store.patchLocalState(
      'map-b',
      { selectedPinId: 'pin-42', persistScope: 'session' },
      'session'
    );
    const loaded = await store.getLocalState('map-b', 'session');
    expect(loaded?.selectedPinId).toBe('pin-42');
    expect(sessionStorage.getItem('geokit.map.local.state.map-b')).toContain('pin-42');
  });

  it('stores snapshot blob in memory without IndexedDB', async () => {
    const store = MapLocalStore.getInstance();
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    await store.setSnapshot({
      mapId: 'map-c',
      providerHint: 'mapbox',
      blob,
      cameraFrame: camera,
      persistScope: 'memory',
    });
    const record = await store.getSnapshot('map-c', 'mapbox');
    expect(record?.byteLength).toBe(3);
    expect(record?.cameraFrame).toEqual(camera);
  });

  it('rejects oversized snapshot blobs', async () => {
    const store = MapLocalStore.getInstance();
    const blob = new Blob([new Uint8Array(MapOfflineDefaults.snapshotMaxBytesPerMap + 1)]);
    await expect(
      store.setSnapshot({
        mapId: 'map-d',
        blob,
        cameraFrame: camera,
      })
    ).rejects.toThrow(/budget/);
  });
});
