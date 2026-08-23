import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { definePluginVitestConfig } from '../../vitest.plugin.config.js';

const pkgRoot = path.dirname(fileURLToPath(import.meta.url));

export default definePluginVitestConfig(import.meta.url, {
  '@geokit/geotypes/geokit': path.resolve(pkgRoot, '../geotypes/src/geokit-adapter.ts'),
});
