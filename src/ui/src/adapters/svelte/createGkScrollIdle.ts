import { createScrollIdle } from '../../utils/scroll-idle';
import { createStore } from './subscribe';

const DEFAULT_IDLE_MS = 350;
let listenerCount = 0;

export type GkScrollIdleState = { isScrollIdle: boolean };

/** Shared scroll-idle store for deferring map mounts during scroll. */
export function createGkScrollIdle(idleMs = DEFAULT_IDLE_MS) {
  const store = createStore<GkScrollIdleState>({ isScrollIdle: true });
  const scrollIdleApi = createScrollIdle({
    idleMs,
    onStateChange: idle => {
      store.set({ isScrollIdle: idle });
    },
  });

  return {
    subscribe: store.subscribe,
    get: store.get,
    start() {
      if (listenerCount++ > 0) return;
      scrollIdleApi.start();
    },
    stop() {
      if (--listenerCount > 0) return;
      scrollIdleApi.stop();
    },
    destroy() {
      scrollIdleApi.stop();
      store.clearSubscribers();
    },
  };
}
