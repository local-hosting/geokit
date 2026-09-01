import type { MapStaticProviderId } from './types/map-provider';
import type { GeokitEnv } from './types/env';
export type MapProviderEnv = GeokitEnv;
export declare function resolveMaptilerKeyFromEnv(env?: GeokitEnv): string | undefined;
export declare function resolveMapboxKeyFromEnv(env?: GeokitEnv): string | undefined;
export declare function resolveMapGenericApiKeyFromEnv(env?: GeokitEnv): string | undefined;
export declare function resolveMapProviderIdFromEnv(env?: GeokitEnv, options?: {
    providerHint?: string;
}): MapStaticProviderId;
export declare function resolveMapApiKeyFromEnv(env: GeokitEnv | undefined, providerId: MapStaticProviderId): string;
export declare function resolveMapRefererFromEnv(env?: GeokitEnv, mapHostBaseUrl?: string): string | undefined;
export declare function resolveDedicatedMapKeysFromEnv(env?: GeokitEnv): {
    maptilerKey?: string;
    mapboxKey?: string;
};
//# sourceMappingURL=map-credentials.d.ts.map