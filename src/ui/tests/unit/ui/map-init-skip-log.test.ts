import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../src/components/elements/map/map-connected-init.ts'),
  'utf8',
);

describe('map init skip logging', () => {
  it('logs structured skip reasons when createMap cannot complete', () => {
    expect(source).toMatch(/noteMapInitSkip/);
    expect(source).toMatch(/init skipped/);
    expect(source).toMatch(/create-map-retry-failed/);
  });
});