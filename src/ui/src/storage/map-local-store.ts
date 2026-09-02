/**
 * Per-map local persistence — camera, selected pin, and snapshot blobs.
 * Domain records (markers, domain records) stay in the host app.
 */

import type {
  MapCameraFrame,
  MapLocalPersistScope,
  MapLocalState,
} from '@twinfile/geokit/core/contract/offline';
import { MapOfflineDefaults } from '@twinfile/geokit/core/contract/offline';
import {
  SNAPSHOT_STORE,
  STATE_STORE,
  idbDelete,
  idbGet,
  idbPut,
} from './indexed-db';

export interface MapSnapshotRecord {
  mapId: string;
  providerHint: string;
  contentType: string;
  cameraFrame: MapCameraFrame;
  selectedPinId?: string;
  capturedAt: number;
  byteLength: number;
  blob: Blob;
}

interface PersistedSnapshotRow {
  key: string;
  mapId: string;
  providerHint: string;
  contentType: string;
  cameraFrame: MapCameraFrame;
  selectedPinId?: string;
  capturedAt: number;
  byteLength: number;
  blob: Blob;
}

const memoryStates = new Map<string, MapLocalState>();
const memorySnapshots = new Map<string, MapSnapshotRecord>();

function sessionStateKey(mapId: string): string {
  return `geokit.map.local.state.${mapId}`;
}

function snapshotKey(mapId: string, providerHint?: string): string {
  return `${mapId}::${providerHint ?? 'default'}`;
}

function resolveScope(scope?: MapLocalPersistScope): MapLocalPersistScope {
  return scope ?? MapOfflineDefaults.durablePersistScope;
}

export class MapLocalStore {
  private static instance: MapLocalStore | null = null;

  static getInstance(): MapLocalStore {
    if (!MapLocalStore.instance) {
      MapLocalStore.instance = new MapLocalStore();
    }
    return MapLocalStore.instance;
  }

  static resetForTesting(): void {
    memoryStates.clear();
    memorySnapshots.clear();
    MapLocalStore.instance = null;
  }

  async getLocalState(
    mapId: string,
    scope: MapLocalPersistScope = MapOfflineDefaults.durablePersistScope
  ): Promise<MapLocalState | null> {
    const resolved = resolveScope(scope);
    if (resolved === 'memory') {
      return memoryStates.get(mapId) ?? null;
    }
    if (resolved === 'session') {
      return readSessionState(mapId);
    }
    const durable = await idbGet<MapLocalState>(STATE_STORE, mapId);
    if (durable) return durable;
    return readSessionState(mapId);
  }

  async setLocalState(state: MapLocalState): Promise<void> {
    const next: MapLocalState = {
      ...state,
      updatedAt: state.updatedAt || Date.now(),
    };
    const scope = resolveScope(next.persistScope);
    if (scope === 'memory') {
      memoryStates.set(next.mapId, next);
      return;
    }
    if (scope === 'session') {
      writeSessionState(next);
      memoryStates.set(next.mapId, next);
      return;
    }
    await idbPut(STATE_STORE, next);
    memoryStates.set(next.mapId, next);
  }

  async patchLocalState(
    mapId: string,
    patch: Partial<Omit<MapLocalState, 'mapId'>>,
    scope: MapLocalPersistScope = MapOfflineDefaults.durablePersistScope
  ): Promise<MapLocalState> {
    const existing =
      (await this.getLocalState(mapId, scope)) ??
      ({
        mapId,
        updatedAt: Date.now(),
        persistScope: scope,
      } satisfies MapLocalState);
    const next: MapLocalState = {
      ...existing,
      ...patch,
      mapId,
      updatedAt: Date.now(),
      persistScope: patch.persistScope ?? existing.persistScope ?? scope,
    };
    await this.setLocalState(next);
    return next;
  }

  async removeLocalState(
    mapId: string,
    scope: MapLocalPersistScope = MapOfflineDefaults.durablePersistScope
  ): Promise<void> {
    memoryStates.delete(mapId);
    if (scope === 'session' || scope === 'durable') {
      removeSessionState(mapId);
    }
    if (scope === 'durable' && typeof indexedDB !== 'undefined') {
      await idbDelete(STATE_STORE, mapId);
    }
  }

  async getSnapshot(
    mapId: string,
    providerHint?: string
  ): Promise<MapSnapshotRecord | null> {
    const key = snapshotKey(mapId, providerHint);
    const cached = memorySnapshots.get(key);
    if (cached) return cached;
    if (typeof indexedDB === 'undefined') return null;
    const row = await idbGet<PersistedSnapshotRow>(SNAPSHOT_STORE, key);
    if (!row) return null;
    const record = rowToSnapshot(row);
    memorySnapshots.set(key, record);
    return record;
  }

  async setSnapshot(input: {
    mapId: string;
    providerHint?: string;
    blob: Blob;
    cameraFrame: MapCameraFrame;
    selectedPinId?: string;
    persistScope?: MapLocalPersistScope;
    capturedAt?: number;
  }): Promise<void> {
    const scope = resolveScope(input.persistScope);
    const byteLength = input.blob.size;
    if (byteLength > MapOfflineDefaults.snapshotMaxBytesPerMap) {
      throw new Error(
        `snapshot exceeds per-map budget (${byteLength} > ${MapOfflineDefaults.snapshotMaxBytesPerMap})`
      );
    }
    const record: MapSnapshotRecord = {
      mapId: input.mapId,
      providerHint: input.providerHint ?? 'default',
      contentType: input.blob.type || 'image/png',
      cameraFrame: input.cameraFrame,
      selectedPinId: input.selectedPinId,
      capturedAt: input.capturedAt ?? Date.now(),
      byteLength,
      blob: input.blob,
    };
    const key = snapshotKey(record.mapId, record.providerHint);
    memorySnapshots.set(key, record);
    if (scope !== 'durable' || typeof indexedDB === 'undefined') {
      return;
    }
    const row: PersistedSnapshotRow = {
      key,
      mapId: record.mapId,
      providerHint: record.providerHint,
      contentType: record.contentType,
      cameraFrame: record.cameraFrame,
      selectedPinId: record.selectedPinId,
      capturedAt: record.capturedAt,
      byteLength: record.byteLength,
      blob: record.blob,
    };
    await idbPut(SNAPSHOT_STORE, row);
  }

  async removeSnapshot(mapId: string, providerHint?: string): Promise<void> {
    const key = snapshotKey(mapId, providerHint);
    memorySnapshots.delete(key);
    if (typeof indexedDB !== 'undefined') {
      await idbDelete(SNAPSHOT_STORE, key);
    }
  }

  async clearMap(mapId: string): Promise<void> {
    await this.removeLocalState(mapId, 'durable');
    await this.removeSnapshot(mapId);
  }
}

function rowToSnapshot(row: PersistedSnapshotRow): MapSnapshotRecord {
  return {
    mapId: row.mapId,
    providerHint: row.providerHint,
    contentType: row.contentType,
    cameraFrame: row.cameraFrame,
    selectedPinId: row.selectedPinId,
    capturedAt: row.capturedAt,
    byteLength: row.byteLength,
    blob: row.blob,
  };
}

function readSessionState(mapId: string): MapLocalState | null {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(sessionStateKey(mapId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MapLocalState;
  } catch {
    return null;
  }
}

function writeSessionState(state: MapLocalState): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(sessionStateKey(state.mapId), JSON.stringify(state));
}

function removeSessionState(mapId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(sessionStateKey(mapId));
}
