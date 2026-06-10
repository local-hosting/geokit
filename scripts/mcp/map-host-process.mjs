/**
 * Probe and optionally spawn the Vite interactive map host for open_map / show_map links.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_MAP_HOST_URL = 'http://localhost:3002';
const MAP_HOST_READY_TIMEOUT_MS = 45_000;
const MAP_HOST_PROBE_TIMEOUT_MS = 1_500;

export function resolveMapHostBaseUrl(env) {
  const base =
    env.MAP_HOST_URL?.trim() || env.GEOKIT_MAP_HOST_URL?.trim() || DEFAULT_MAP_HOST_URL;
  return base.replace(/\/$/, '');
}

export function isAutoMapHostEnabled(env) {
  const raw = env.GEOKIT_AUTO_MAP_HOST?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') {
    return false;
  }
  return true;
}

export async function probeMapHost(baseUrl, timeoutMs = MAP_HOST_PROBE_TIMEOUT_MS) {
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

export async function waitForMapHost(baseUrl, options = {}) {
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

function findViteCli(geokitRoot, monorepoRoot) {
  const candidates = [
    join(geokitRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
    join(monorepoRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
  ];
  return candidates.find((path) => existsSync(path));
}

export function startMapHostProcess(geokitRoot, env) {
  const monorepoRoot = join(geokitRoot, '..', '..');
  const viteCli = findViteCli(geokitRoot, monorepoRoot);
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
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  const logChunk = (chunk) => {
    const text = chunk.toString().trimEnd();
    if (text) {
      console.error(`[geokit map-host] ${text}`);
    }
  };

  child.stdout?.on('data', logChunk);
  child.stderr?.on('data', logChunk);

  return child;
}

/**
 * Start map-host when auto-start is enabled and nothing is listening yet.
 * @returns {{ started: boolean, child: import('node:child_process').ChildProcess | null, baseUrl: string }}
 */
export async function ensureMapHostRunning(geokitRoot, env) {
  const baseUrl = resolveMapHostBaseUrl(env);

  if (!isAutoMapHostEnabled(env)) {
    return { started: false, child: null, baseUrl };
  }

  if (await probeMapHost(baseUrl)) {
    console.error(`[geokit] Interactive map host already running at ${baseUrl}`);
    return { started: false, child: null, baseUrl };
  }

  console.error(`[geokit] Starting interactive map host at ${baseUrl} …`);

  let child;
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

export function stopMapHostProcess(child) {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
}
