import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLibraryTsupConfig } from '../../../config/tsup.library.config.js';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function packageEntries() {
  /** @param {string} root @returns {string[]} */
  function walk(root) {
    const entries = [];
    for (const name of readdirSync(root)) {
      const full = join(root, name);
      if (statSync(full).isDirectory()) {
        entries.push(...walk(full));
      } else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) {
        entries.push(relative(packageRoot, full).replace(/\\/g, '/'));
      }
    }
    return entries;
  }
  return [...walk(join(packageRoot, 'src')), ...walk(join(packageRoot, 'generated'))];
}

const [esm, cjs] = createLibraryTsupConfig(packageRoot);
const entries = packageEntries();
esm.entry = entries;
cjs.entry = entries;

export default [esm, cjs];
