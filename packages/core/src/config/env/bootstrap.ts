import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';
import type { GeokitEnv } from '../../types/env.js';
import { applyGeokitEnvAliases } from './aliases.js';

function mergeDotenvFile(env: GeokitEnv, dotenvPath: string): void {
  if (!existsSync(dotenvPath)) return;
  const parsed = dotenv.parse(readFileSync(dotenvPath));
  for (const [key, value] of Object.entries(parsed)) {
    if (!env[key]?.trim()) {
      env[key] = value;
    }
  }
}

/**
 * Load geokit + monorepo dotenv files, apply legacy key aliases, and apply MCP defaults.
 * Cursor-injected process.env wins over dotenv when both are set.
 */
export function loadGeokitProcessEnv(
  geokitRoot: string,
  baseEnv: GeokitEnv = process.env
): GeokitEnv {
  const env = { ...baseEnv };
  const monorepoRoot = join(geokitRoot, '..', '..');

  mergeDotenvFile(env, join(geokitRoot, '.env'));
  mergeDotenvFile(env, join(monorepoRoot, '.env'));

  const normalized = applyGeokitEnvAliases(env);
  for (const [key, value] of Object.entries(normalized)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  return env;
}

export function applyLoadedEnvToProcess(env: GeokitEnv): void {
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

export function bootstrapGeokitMcpEnv(geokitRoot: string): GeokitEnv {
  const loaded = loadGeokitProcessEnv(geokitRoot);
  applyLoadedEnvToProcess(loaded);
  return loaded;
}
