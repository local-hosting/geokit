import { createMapMountPolicy } from '../shared/mount-policy.js';
import type { MapMountPolicyOptions } from '../shared/types.js';
import { createStore } from './subscribe.js';

export type GkMapMountState = {
  shouldMount: boolean;
  isVisible: boolean;
  isScrollIdle: boolean;
};

export type CreateGkMapMountOptions = MapMountPolicyOptions;

/** Svelte-friendly mount policy with store-compatible subscribe(). */
export function createGkMapMount(options: CreateGkMapMountOptions = {}) {
  const immediate = options.mode === 'immediate';
  const store = createStore<GkMapMountState>({
    shouldMount: immediate,
    isVisible: immediate,
    isScrollIdle: options.mode !== 'when-visible-and-idle',
  });

  const policy = createMapMountPolicy({
    ...options,
    onShouldMountChange: shouldMount => {
      store.set({ ...store.get(), shouldMount });
    },
    onVisibleChange: isVisible => {
      store.set({ ...store.get(), isVisible });
    },
    onScrollIdleChange: isScrollIdle => {
      store.set({ ...store.get(), isScrollIdle });
    },
  });

  return {
    subscribe: store.subscribe,
    get: store.get,
    start(container: HTMLElement) {
      policy.stop();
      policy.start(container);
    },
    stop() {
      policy.stop();
    },
    forceMount() {
      policy.forceMount();
    },
    requestRemount() {
      if (!store.get().shouldMount) {
        policy.forceMount();
        return;
      }
      store.set({ ...store.get(), shouldMount: false });
      queueMicrotask(() => policy.forceMount());
    },
    destroy() {
      policy.stop();
      store.clearSubscribers();
    },
  };
}
