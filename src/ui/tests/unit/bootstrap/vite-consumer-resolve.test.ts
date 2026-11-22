import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { geokitConsumerViteResolveAliases } from '../../../src/bootstrap/vite-consumer-resolve';

const geokitRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');

describe('geokitConsumerViteResolveAliases', () => {
  it('points maplibre imports at the dev bundle with a default export under geokit', () => {
    // maplibre only — mapbox/maptiler covered when nested deps are installed
    const aliases = geokitConsumerViteResolveAliases(geokitRoot);
    const maplibreJs = aliases.find(
      (a) => a.find instanceof RegExp && a.find.source === '^maplibre-gl$'
    );
    const maplibreCss = aliases.find(
      (a) => a.find instanceof RegExp && a.find.source === '^maplibre-gl\\/dist\\/maplibre-gl\\.css$'
    );
    expect(maplibreJs).toBeDefined();
    expect(maplibreJs?.replacement).toMatch(/maplibre-gl-dev\.js$/);
    expect(maplibreCss).toBeDefined();
    expect(maplibreCss?.replacement).toMatch(/maplibre-gl\.css$/);
    expect(existsSync(maplibreJs!.replacement)).toBe(true);
    expect(existsSync(maplibreCss!.replacement)).toBe(true);
  });
});