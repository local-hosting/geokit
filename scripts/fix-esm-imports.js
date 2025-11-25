import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
          // Skip if it already has an extension
          if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
            return match;
          }
          
          // Check if it's a directory or file
          const resolvedPath = join(fileDir, importPath);
          if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
            // It's a directory, use /index.js
            return `from '${importPath}/index.js'`;
          }
          
          // Assume it's a file and add .js
          return `from '${importPath}.js'`;
        }
      );

      await writeFile(fullPath, content, 'utf-8');
    }
  }
}

async function main() {
  const distEsm = join(__dirname, '..', 'dist', 'esm');

  try {
    await fixEsmImports(distEsm);
    console.log('✓ Fixed ESM import extensions in dist/esm');
  } catch (error) {
    console.error('Error fixing ESM imports:', error);
    process.exit(1);
  }
}

main();

