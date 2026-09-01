import type { GeokitEnv } from './types/env';
/**
 * Load geokit + monorepo dotenv files, apply legacy key aliases, and apply MCP defaults.
 * Cursor-injected process.env wins over dotenv when both are set.
 */
export declare function loadGeokitProcessEnv(geokitRoot: string, baseEnv?: GeokitEnv): GeokitEnv;
export declare function applyLoadedEnvToProcess(env: GeokitEnv): void;
export declare function bootstrapGeokitMcpEnv(geokitRoot: string): GeokitEnv;
//# sourceMappingURL=bootstrap.d.ts.map