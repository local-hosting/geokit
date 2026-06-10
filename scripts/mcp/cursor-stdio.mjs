#!/usr/bin/env node
/**
 * Cursor MCP entry — node + tsx.
 * Loads packages/geokit/.env, mints Globe CDN DMA JWT, then starts the server.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGeokitMcpEnv } from './load-mcp-env.mjs';
import { mintGlobeCdnJwtForMcp } from './mint-cdn-jwt.mjs';

const geokitRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const monorepoRoot = join(geokitRoot, '..', '..');
const tsxCandidates = [
  join(geokitRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  join(monorepoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
];
const tsxCli = tsxCandidates.find((path) => existsSync(path));
const serverTs = join(geokitRoot, 'src', 'mcp', 'server.ts');

if (!tsxCli) {
  console.error(
    `[geokit] Missing tsx. From monorepo root: yarn install — or from geokit: yarn install`
  );
  process.exit(1);
}

const env = loadGeokitMcpEnv(geokitRoot);

if (!env.MAP_HOST_URL?.trim() && !env.GEOKIT_MAP_HOST_URL?.trim()) {
  env.MAP_HOST_URL = 'http://localhost:3002';
}

const cdnJwt = await mintGlobeCdnJwtForMcp(env);
if (cdnJwt) {
  console.error('[geokit] Globe CDN DMA auth ready (JWT minted for MCP).');
} else {
  console.error(
    '[geokit] WARNING: no GLOBE_CDN_JWT or GLOBE_CDN_JWT_SECRET — DMA outlines (e.g. "New York DMA") will fail. Add GLOBE_CDN_JWT_SECRET to packages/geokit/.env.'
  );
}

const child = spawn(process.execPath, [tsxCli, serverTs], {
  cwd: geokitRoot,
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
