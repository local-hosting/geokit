/**
 * Copy theme.css into dist so the published package always includes it
 * (consumers resolve @twinfile/geokit/ui/theme.css from dist).
 */
import { copyFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const root = join(__dirname, '../..');
const src = join(root, 'src/ui/theme.css');
const destDir = join(root, 'dist/ui');
const dest = join(destDir, 'theme.css');

await mkdir(destDir, { recursive: true });
await copyFile(src, dest);
console.log('[geokit build] copied theme.css to dist/ui/theme.css');
