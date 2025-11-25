import { readdir, readFile, writeFile, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function renameJsToCjs(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await renameJsToCjs(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      // Read and fix require() calls BEFORE renaming
      let content = await readFile(fullPath, 'utf-8');
      const fileDir = dirname(fullPath);
      
      // Fix require() calls to use .cjs extension
      content = content.replace(
        /require\(['"](\.\.?\/[^'"]+)(?<!\.cjs)(?<!\.js)['"]\)/g,
        (match, requirePath) => {
          // Skip if it already has an extension
          if (requirePath.endsWith('.cjs') || requirePath.endsWith('.json')) {
            return match;
          }
          
          // Check if it's a directory or file (check for .js file first, then directory)
          const resolvedPathJs = join(fileDir, requirePath + '.js');
          const resolvedPath = join(fileDir, requirePath);
          
          if (existsSync(resolvedPathJs)) {
            // File exists as .js, will be renamed to .cjs
            return `require('${requirePath}.cjs')`;
          } else if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
            // It's a directory, use /index.cjs
            return `require('${requirePath}/index.cjs')`;
          }
          
          // Assume it's a file and add .cjs
          return `require('${requirePath}.cjs')`;
        }
      );
      
      // Rename .js to .cjs
      const cjsPath = fullPath.replace(/\.js$/, '.cjs');
      await writeFile(cjsPath, content, 'utf-8');
      await unlink(fullPath);
    }
  }
}

async function main() {
  const distCjs = join(__dirname, '..', 'dist', 'cjs');

  try {
    await renameJsToCjs(distCjs);
    console.log('✓ Renamed CommonJS files from .js to .cjs in dist/cjs');
  } catch (error) {
    console.error('Error renaming CJS files:', error);
    process.exit(1);
  }
}

main();
