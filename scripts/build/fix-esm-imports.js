import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ASSET_EXTENSIONS = ['.js', '.json', '.css'];

function hasAssetExtension(importPath) {
  return ASSET_EXTENSIONS.some((ext) => importPath.endsWith(ext));
}

async function fixEsmImports(dir, baseDir = null) {
  if (!baseDir) baseDir = dir;
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await fixEsmImports(fullPath, baseDir);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      let content = await readFile(fullPath, 'utf-8');
      const fileDir = dirname(fullPath);
      
      // Fix relative imports: from './file' or '../file' -> from './file.js' or '../file.js' or './dir/index.js'
      content = content.replace(
        /from\s+['"](\.\.?\/[^'"]+)(?<!\.js)(?<!\/index)['"]/g,
        (match, importPath) => {
          if (hasAssetExtension(importPath)) {
            return match;
          }

          const resolvedPath = join(fileDir, importPath);
          if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
            return `from '${importPath}/index.js'`;
          }

          return `from '${importPath}.js'`;
        }
      );

      // Fix dynamic imports: import('...') -> import('...js')
      // First, remove .ts extensions if they exist
      content = content.replace(
        /import\s*\(\s*['"](\.\.?\/[^'"]+)\.ts['"]\s*\)/g,
        (match, importPath) => {
          // Remove .ts extension and fix the path
          const resolvedPath = join(fileDir, importPath);
          if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
            return `import('${importPath}/index.js')`;
          }
          return `import('${importPath}.js')`;
        }
      );

      // Then, fix dynamic imports without extensions
      content = content.replace(
        /import\s*\(\s*['"](\.\.?\/[^'"]+)(?<!\.js)(?<!\.json)(?<!\/index)['"]\s*\)/g,
        (match, importPath) => {
          if (hasAssetExtension(importPath)) {
            return match;
          }

          const resolvedPath = join(fileDir, importPath);
          if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
            return `import('${importPath}/index.js')`;
          }

          return `import('${importPath}.js')`;
        }
      );

      await writeFile(fullPath, content, 'utf-8');
    }
  }
}

async function main() {
  const distEsm = join(__dirname, '..', '..', 'dist', 'esm');

  try {
    await fixEsmImports(distEsm);
    console.log('✓ Fixed ESM import extensions in dist/esm');
  } catch (error) {
    console.error('Error fixing ESM imports:', error);
    process.exit(1);
  }
}

main();

