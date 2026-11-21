import { describe, expect, it } from 'vitest';
import { createGkScrollIdle } from '../../../../src/adapters/svelte/createGkScrollIdle';

describe('createGkScrollIdle', () => {
  it('notifies subscribers when scroll idle state changes', () => {
    const idle = createGkScrollIdle(50);
    const values: boolean[] = [];
    const unsub = idle.subscribe(state => values.push(state.isScrollIdle));

    expect(values).toEqual([true]);

    idle.start();
    window.dispatchEvent(new Event('scroll'));
    expect(values.at(-1)).toBe(false);

    idle.destroy();
    unsub();
  });
});
