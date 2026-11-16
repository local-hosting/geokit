#!/usr/bin/env node
/**
 * Symlink this package as node_modules/@doppler-group/geokit so dist imports resolve
 * when running export-parity-fixtures or other core scripts from source.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const geokitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const linkDir = path.join(geokitRoot, 'node_modules', '@twinfile');
const linkPath = path.join(linkDir, 'geokit');

fs.mkdirSync(linkDir, { recursive: true });

try {
  const stat = fs.lstatSync(linkPath);
  if (stat.isSymbolicLink() || stat.isDirectory()) {
    fs.unlinkSync(linkPath);
  }
} catch (err) {
  if (err && typeof err === 'object' && 'code' in err && err.code !== 'ENOENT') {
    throw err;
  }
}

fs.symlinkSync(geokitRoot, linkPath, 'dir');
console.log(`@doppler-group/geokit → ${geokitRoot}`);
