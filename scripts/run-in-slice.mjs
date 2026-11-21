#!/usr/bin/env node
/**
 * Run a binary from geokit root node_modules with cwd set to a slice directory.
 * Needed because nested slice package.json dirs are not Yarn workspaces.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [sliceDir, binary, ...args] = process.argv.slice(2);

if (!sliceDir || !binary) {
  console.error('Usage: run-in-slice.mjs <slice-dir> <binary> [args...]');
  process.exit(1);
}

const cwd = path.isAbsolute(sliceDir) ? sliceDir : path.join(repoRoot, sliceDir);
const executable = path.join(repoRoot, 'node_modules', '.bin', binary);
const result = spawnSync(executable, args, { cwd, stdio: 'inherit', env: process.env });

process.exit(result.status === null ? 1 : result.status);