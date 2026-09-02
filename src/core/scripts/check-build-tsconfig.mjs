import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const configPath = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'config', 'tsconfig.build.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const paths = config.compilerOptions?.paths ?? {};

const forbidden = Object.keys(paths).filter(
  (key) => key === '@twinfile/geokit/h3' || key.startsWith('@twinfile/geokit/h3/')
);

if (forbidden.length > 0) {
  console.error(
    '[@twinfile/geokit/core] tsconfig.build.json must not path-map @twinfile/geokit/h3 — tsc will emit .d.ts into src/h3/src.'
  );
  for (const key of forbidden) {
    console.error(`  paths["${key}"]`);
  }
  process.exit(1);
}
