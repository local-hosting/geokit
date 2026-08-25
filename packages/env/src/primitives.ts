/// <reference path="./import-meta.d.ts" />

import type { GeokitEnv } from './types/env.js';

export function envTrim(env: GeokitEnv, key: string): string | undefined {
  const value = env[key]?.trim();
  return value || undefined;
}

export function firstEnv(env: GeokitEnv, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = envTrim(env, key);
    if (value) return value;
  }
  return undefined;
}

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

export function readViteEnv(): GeokitEnv {
  if (typeof import.meta === 'undefined' || !(import.meta as ImportMeta & { env?: GeokitEnv }).env) {
    return {};
  }
  return (import.meta as ImportMeta & { env?: GeokitEnv }).env as GeokitEnv;
}

export function readProcessEnv(): GeokitEnv {
  if (typeof process !== 'undefined' && process.env) {
    return process.env;
  }
  return {};
}

/** Node process.env when available, otherwise Vite (import.meta as ImportMeta & { env?: GeokitEnv }).env. */
export function readRuntimeEnv(): GeokitEnv {
  const fromProcess = readProcessEnv();
  if (Object.keys(fromProcess).length > 0) {
    return fromProcess;
  }
  return readViteEnv();
}

export function writeEnvKeys(env: GeokitEnv, keys: readonly string[], value: string): void {
  for (const key of keys) {
    env[key] = value;
  }
}
