import { readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const ASSET_EXTENSIONS = ['.js', '.json', '.css', '.cjs'];

function hasAssetExtension(importPath) {
  return ASSET_EXTENSIONS.some((ext) => importPath.endsWith(ext));
}

/** @param {string} packageRoot absolute path to package folder (contains src/) */
export function createLibraryTsupConfig(packageRoot) {
  function srcEntries() {
    function walk(dir) {
      const entries = [];
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        const rel = relative(packageRoot, full).replace(/\\/g, '/');
        if (statSync(full).isDirectory()) {
          entries.push(...walk(full));
        } else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) {
          entries.push(rel);
        }
      }
      return entries;
    }
    return walk(join(packageRoot, 'src'));
  }

  async function fixEsmImports(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await fixEsmImports(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.js')) continue;

      let content = await readFile(fullPath, 'utf8');
      const fileDir = dirname(fullPath);
      content = content.replace(
        /from\s+(['"])(\.\.?\/[^'"]+?)(?<!\.js)\1/g,
        (match, quote, importPath) => {
          if (hasAssetExtension(importPath)) return match;
          const resolvedPath = join(fileDir, importPath);
          if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
            return `from ${quote}${importPath}/index.js${quote}`;
          }
          return `from ${quote}${importPath}.js${quote}`;
        },
      );
      await writeFile(fullPath, content, 'utf8');
    }
  }

  async function fixCjsRequires(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await fixCjsRequires(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.cjs')) continue;

      let content = await readFile(fullPath, 'utf8');
      const fileDir = dirname(fullPath);
      content = content.replace(
        /require\(['"](\.\.?\/[^'"]+)(?<!\.cjs)(?<!\.js)['"]\)/g,
        (match, requirePath) => {
          if (requirePath.endsWith('.cjs') || requirePath.endsWith('.json')) return match;
          const resolvedPathCjs = join(fileDir, `${requirePath}.cjs`);
          const resolvedPath = join(fileDir, requirePath);
          if (existsSync(resolvedPathCjs)) return `require('${requirePath}.cjs')`;
          if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
            return `require('${requirePath}/index.cjs')`;
          }
          return `require('${requirePath}.cjs')`;
        },
      );
      await writeFile(fullPath, content, 'utf8');
    }
  }

  const tsconfig = existsSync(join(packageRoot, 'config/tsconfig.build.json'))
    ? 'config/tsconfig.build.json'
    : 'tsconfig.json';

  return [
    {
      name: 'esm',
      entry: srcEntries(),
      format: ['esm'],
      outDir: 'dist/esm',
      dts: false,
      bundle: false,
      splitting: false,
      sourcemap: true,
      clean: true,
      platform: 'node',
      tsconfig,
    },
    {
      name: 'cjs',
      entry: srcEntries(),
      format: ['cjs'],
      outDir: 'dist/cjs',
      outExtension: () => ({ js: '.cjs' }),
      bundle: false,
      splitting: false,
      sourcemap: true,
      clean: false,
      platform: 'node',
      tsconfig,
      onSuccess: async () => {
        await fixEsmImports(join(packageRoot, 'dist/esm'));
        await fixCjsRequires(join(packageRoot, 'dist/cjs'));
      },
    },
  ];
}
