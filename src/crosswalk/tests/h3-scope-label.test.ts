import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

import { h3ForZip } from '../src/index.ts';
import { h3ScopeLabel, resetH3ScopeLabelCache } from '../src/lookup/h3-scope-label.ts';
import { loadUsCrosswalkSync } from '../src/load/load';

describe('h3ScopeLabel', () => {
  beforeAll(() => {
    loadUsCrosswalkSync();
  });

  beforeEach(() => {
    resetH3ScopeLabelCache();
  });

  it('returns a US market label from crosswalk without network I/O', () => {
    const h3 = h3ForZip('46204');
    expect(h3).toBeTruthy();
    const result = h3ScopeLabel(h3!);
    expect(result).not.toBeNull();
    expect(result!.source).toBe('crosswalk');
    expect(result!.label).toMatch(/indianapolis/i);
    expect(result!.shortTitle).toMatch(/indianapolis/i);
  });

  it('reuses cached labels for the same H3 cell', () => {
    const h3 = h3ForZip('46204');
    expect(h3).toBeTruthy();
    const first = h3ScopeLabel(h3!);
    const second = h3ScopeLabel(h3!);
    expect(second).toBe(first);
  });

  it('returns null for blank input', () => {
    expect(h3ScopeLabel('')).toBeNull();
  });
});