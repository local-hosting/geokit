import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const poolSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../src/components/elements/map-collection/map-collection-pool.ts'),
  'utf8',
);

const placeholderSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../src/components/elements/map/map-style-setup.ts'),
  'utf8',
);

describe('map-collection activateSlot recoverable unfreeze', () => {
  it('does not re-freeze pool maps on transient init skip', () => {
    expect(poolSource).toMatch(/isRecoverableMapInitSkipReason/);
    expect(poolSource).toMatch(/activateSlot: transient init, skip freeze/);
  });
});

describe('map placeholder stuck timer', () => {
  it('restarts stuck check when Restoring message is shown again', () => {
    expect(placeholderSource).toMatch(
      /existingPlaceholder[\s\S]*_startStuckCheckIfLoading\(text\)/,
    );
  });
});

const observersSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../src/components/elements/map-collection/map-collection-observers.ts'),
  'utf8',
);

describe('map-collection restoring health check', () => {
  it('retries visible slots stuck on Restoring placeholder', () => {
    expect(observersSource).toMatch(/checkStuckRestoringPlaceholder/);
    expect(observersSource).toMatch(/activateSlot\(slot\)/);
  });
});