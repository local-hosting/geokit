import { type GeokitEnv } from './types/env';
export declare const DEFAULT_MAP_HOST_URL = "http://localhost:3002";
export declare function resolveGeocodingApiKey(env?: GeokitEnv): string | undefined;
export declare function resolveRoutingAccessToken(env?: GeokitEnv): string | undefined;
export declare function resolveGooglePlacesApiKey(env?: GeokitEnv): string | undefined;
export declare function resolveHereApiKey(env?: GeokitEnv): string | undefined;
export declare function resolveEsriApiKey(env?: GeokitEnv): string | undefined;
export declare function resolveFoursquareApiKey(env?: GeokitEnv): string | undefined;
export declare function resolveMapHostBaseUrlFromEnv(env?: GeokitEnv): string;
//# sourceMappingURL=service-keys.d.ts.map