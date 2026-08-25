import { describe, expect, it } from 'vitest';
import { createGkMapMount } from '../../../../src/adapters/svelte/createGkMapMount';

describe('createGkMapMount', () => {
  it('immediate mode mounts immediately', () => {
    const mount = createGkMapMount({ mode: 'immediate' });
    const container = document.createElement('div');
    document.body.appendChild(container);

    mount.start(container);
    expect(mount.get().shouldMount).toBe(true);

    mount.destroy();
    container.remove();
  });

  it('requestRemount toggles shouldMount then forces mount', async () => {
    const mount = createGkMapMount({ mode: 'when-visible', visibleStableMs: 0 });
    const container = document.createElement('div');
    document.body.appendChild(container);
    mount.start(container);
    mount.forceMount();

    const seen: boolean[] = [];
    const unsub = mount.subscribe(state => seen.push(state.shouldMount));

    mount.requestRemount();
    expect(seen).toContain(false);

    await new Promise<void>(resolve => queueMicrotask(resolve));
    expect(mount.get().shouldMount).toBe(true);

    unsub();
    mount.destroy();
    container.remove();
  });
});
