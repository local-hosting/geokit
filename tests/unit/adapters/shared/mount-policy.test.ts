import { describe, expect, it, vi } from 'vitest';
import { createMapMountPolicy } from '../../../../src/adapters/shared/mount-policy.js';

describe('createMapMountPolicy', () => {
  it('immediate mode mounts right away', () => {
    const onShouldMountChange = vi.fn();
    const policy = createMapMountPolicy({ mode: 'immediate', onShouldMountChange });
    const container = document.createElement('div');
    document.body.appendChild(container);

    policy.start(container);
    expect(policy.getShouldMount()).toBe(true);
    expect(onShouldMountChange).toHaveBeenCalledWith(true);

    policy.stop();
    container.remove();
  });

  it('stickyMount keeps shouldMount true after visible', () => {
    const policy = createMapMountPolicy({
      mode: 'when-visible',
      stickyMount: true,
      visibleStableMs: 0,
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    policy.start(container);
    policy.forceMount();
    expect(policy.getShouldMount()).toBe(true);
    policy.stop();
    container.remove();
  });

  it('when-visible mode waits for intersection', () => {
    const policy = createMapMountPolicy({ mode: 'when-visible', visibleStableMs: 0 });
    const container = document.createElement('div');
    document.body.appendChild(container);

    policy.start(container);
    expect(policy.getShouldMount()).toBe(false);

    policy.forceMount();
    expect(policy.getShouldMount()).toBe(true);

    policy.stop();
    container.remove();
  });

  it('forceMount re-notifies when already mounted (remount path)', () => {
    const onShouldMountChange = vi.fn();
    const policy = createMapMountPolicy({
      mode: 'when-visible',
      stickyMount: true,
      visibleStableMs: 0,
      onShouldMountChange,
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    policy.start(container);
    policy.forceMount();
    onShouldMountChange.mockClear();

    policy.forceMount();
    expect(onShouldMountChange).toHaveBeenCalledWith(true);
    expect(policy.getShouldMount()).toBe(true);

    policy.stop();
    container.remove();
  });
});
