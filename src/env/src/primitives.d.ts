import type { GeokitEnv } from './types/env';
export declare function envTrim(env: GeokitEnv, key: string): string | undefined;
export declare function firstEnv(env: GeokitEnv, keys: readonly string[]): string | undefined;
export declare function stripTrailingSlash(url: string): string;
export declare function readViteEnv(): GeokitEnv;
export declare function readProcessEnv(): GeokitEnv;
/** Node process.env when available, otherwise Vite (import.meta as ImportMeta & { env?: GeokitEnv }).env. */
export declare function readRuntimeEnv(): GeokitEnv;
export declare function writeEnvKeys(env: GeokitEnv, keys: readonly string[], value: string): void;
//# sourceMappingURL=primitives.d.ts.map