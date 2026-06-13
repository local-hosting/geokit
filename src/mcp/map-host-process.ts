import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveMapHostBaseUrlFromEnv } from '../config/env/index.js';
import type { GeokitEnv } from '../types/env.js';

const MAP_HOST_READY_TIMEOUT_MS = 45_000;
const MAP_HOST_PROBE_TIMEOUT_MS = 1_500;

export function isAutoMapHostEnabled(env: GeokitEnv = process.env): boolean {
  const raw = env.GEOKIT_AUTO_MAP_HOST?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') {
    return false;
  }
  return true;
}

export async function probeMapHost(
  baseUrl: string,
  timeoutMs = MAP_HOST_PROBE_TIMEOUT_MS
): Promise<boolean> {
  const url = `${baseUrl.replace(/\/$/, '')}/index.html`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function waitForMapHost(
  baseUrl: string,
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? MAP_HOST_READY_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? 250;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await probeMapHost(baseUrl)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

function findViteCli(geokitRoot: string): string | undefined {
  const monorepoRoot = join(geokitRoot, '..', '..');
  const candidates = [
    join(geokitRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
    join(monorepoRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
  ];
  return candidates.find((path) => existsSync(path));
}

export function startMapHostProcess(geokitRoot: string, env: GeokitEnv): ChildProcess {
  const viteCli = findViteCli(geokitRoot);
  if (!viteCli) {
    throw new Error(
      '[geokit] Missing vite. From monorepo root: yarn install — or from geokit: yarn install'
    );
  }

  const child = spawn(
    process.execPath,
    [viteCli, '--config', join(geokitRoot, 'config', 'vite.mcp-host.config.js')],
    {
      cwd: geokitRoot,
      env: env as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  const logChunk = (chunk: Buffer | string) => {
    const text = chunk.toString().trimEnd();
    if (text) {
      console.error(`[geokit map-host] ${text}`);
    }
  };

  child.stdout?.on('data', logChunk);
  child.stderr?.on('data', logChunk);

  return child;
}

export type MapHostRunResult = {
  started: boolean;
  child: ChildProcess | null;
  baseUrl: string;
};

/** Start map-host when auto-start is enabled and nothing is listening yet. */
export async function ensureMapHostRunning(
  geokitRoot: string,
  env: GeokitEnv = process.env
): Promise<MapHostRunResult> {
  const baseUrl = resolveMapHostBaseUrlFromEnv(env);

  if (!isAutoMapHostEnabled(env)) {
    return { started: false, child: null, baseUrl };
  }

  if (await probeMapHost(baseUrl)) {
    console.error(`[geokit] Interactive map host already running at ${baseUrl}`);
    return { started: false, child: null, baseUrl };
  }

  console.error(`[geokit] Starting interactive map host at ${baseUrl} …`);

  let child: ChildProcess;
  try {
    child = startMapHostProcess(geokitRoot, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[geokit] WARNING: could not start map host — ${message}`);
    return { started: false, child: null, baseUrl };
  }

  const ready = await waitForMapHost(baseUrl);
  if (!ready) {
    child.kill('SIGTERM');
    console.error(
      `[geokit] WARNING: map host did not become ready at ${baseUrl} — run yarn map-host or set GEOKIT_AUTO_MAP_HOST=0`
    );
    return { started: false, child: null, baseUrl };
  }

  console.error(`[geokit] Interactive map host ready at ${baseUrl}`);
  return { started: true, child, baseUrl };
}

export function stopMapHostProcess(child: ChildProcess | null | undefined): void {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
}
