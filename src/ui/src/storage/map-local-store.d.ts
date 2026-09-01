/**
 * Per-map local persistence — camera, selected pin, and snapshot blobs.
 * Domain records (markers, domain records) stay in the host app.
 */
import type { MapCameraFrame, MapLocalPersistScope, MapLocalState } from '@geokit/core/contract/offline';
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
export declare class MapLocalStore {
    private static instance;
    static getInstance(): MapLocalStore;
    static resetForTesting(): void;
    getLocalState(mapId: string, scope?: MapLocalPersistScope): Promise<MapLocalState | null>;
    setLocalState(state: MapLocalState): Promise<void>;
    patchLocalState(mapId: string, patch: Partial<Omit<MapLocalState, 'mapId'>>, scope?: MapLocalPersistScope): Promise<MapLocalState>;
    removeLocalState(mapId: string, scope?: MapLocalPersistScope): Promise<void>;
    getSnapshot(mapId: string, providerHint?: string): Promise<MapSnapshotRecord | null>;
    setSnapshot(input: {
        mapId: string;
        providerHint?: string;
        blob: Blob;
        cameraFrame: MapCameraFrame;
        selectedPinId?: string;
        persistScope?: MapLocalPersistScope;
        capturedAt?: number;
    }): Promise<void>;
    removeSnapshot(mapId: string, providerHint?: string): Promise<void>;
    clearMap(mapId: string): Promise<void>;
}
//# sourceMappingURL=map-local-store.d.ts.map