#!/usr/bin/env node
/**
 * Cursor MCP entry — node + tsx. Expect MAPTILER_KEY in MCP env (see cursor-mcp-snippet.json).
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const geokitRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const corioRoot = join(geokitRoot, '..', '..');
const tsxCandidates = [
  join(geokitRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  join(corioRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
];
const tsxCli = tsxCandidates.find((path) => existsSync(path));
const serverTs = join(geokitRoot, 'src', 'mcp', 'server.ts');

if (!tsxCli) {
  console.error(
    `[geokit] Missing tsx. From corio root: yarn install — or from geokit: yarn install`
  );
  process.exit(1);
}

if (!process.env.MAP_HOST_URL?.trim() && !process.env.GEOKIT_MAP_HOST_URL?.trim()) {
  process.env.MAP_HOST_URL = 'http://localhost:3002';
}

const child = spawn(process.execPath, [tsxCli, serverTs], {
  cwd: geokitRoot,
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
