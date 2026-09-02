import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLibraryTsupConfig } from '../../../../config/tsup.library.config.js';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
export default createLibraryTsupConfig(packageRoot);
