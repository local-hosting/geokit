import { describe, expect, it } from 'vitest';
import { isRecoverableMapInitSkipReason } from '../../../src/components/elements/map/lifecycle/map-init-skip-reason';

describe('isRecoverableMapInitSkipReason', () => {
  it('treats transient create / WebGL skip reasons as recoverable', () => {
    expect(isRecoverableMapInitSkipReason('webgl-budget-full')).toBe(true);
    expect(isRecoverableMapInitSkipReason('create-map-failed')).toBe(true);
    expect(isRecoverableMapInitSkipReason('create-map-retry-failed')).toBe(true);
    expect(isRecoverableMapInitSkipReason('create-map-null-instance')).toBe(true);
    expect(isRecoverableMapInitSkipReason('disconnected-during-webgl-wait')).toBe(true);
  });

  it('returns false for null or unknown reasons', () => {
    expect(isRecoverableMapInitSkipReason(null)).toBe(false);
    expect(isRecoverableMapInitSkipReason('unknown')).toBe(false);
  });
});