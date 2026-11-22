import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../src/components/elements/map/map-connected-init.ts'),
  'utf8'
);

describe('map standalone init retry', () => {
  it('schedules retry when createMap fails without pool management', () => {
    expect(source).toMatch(/scheduleStandaloneInitRetry/);
    expect(source).toMatch(/webgl-budget-full/);
    expect(source).toMatch(/create-map-failed/);
    expect(source).toMatch(/isUpgradedMapCollectionAncestor/);
  });
});