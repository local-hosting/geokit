import { describe, expect, it } from 'vitest';
import { shouldSilenceStyleLoadPoll } from '../../../src/components/elements/map/style/style-load-poll-guard';

describe('shouldSilenceStyleLoadPoll', () => {
  it('aborts when the map instance is gone', () => {
    expect(shouldSilenceStyleLoadPoll({ hasMap: false, isFrozen: false })).toBe(true);
  });

  it('aborts when the element is frozen', () => {
    expect(shouldSilenceStyleLoadPoll({ hasMap: true, isFrozen: true })).toBe(true);
  });

  it('continues polling while the map is live and unfrozen', () => {
    expect(shouldSilenceStyleLoadPoll({ hasMap: true, isFrozen: false })).toBe(false);
  });
});