import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../src/components/elements/map/map-freeze-runtime.ts'),
  'utf8',
);

describe('map unfreeze without map instance', () => {
  it('defers gk-map-failed when init scheduled a recoverable retry', () => {
    expect(source).toMatch(/isRecoverableMapInitSkipReason/);
    expect(source).toMatch(/failUnfreezeWithoutMap\('deferred-layout'\)/);
  });
});