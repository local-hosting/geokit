import { readonly, ref } from 'vue';
import { createScrollIdle } from '../../utils/scroll-idle';

const DEFAULT_IDLE_MS = 350;

const isScrollIdle = ref(true);
const scrollIdleApi = createScrollIdle({
  idleMs: DEFAULT_IDLE_MS,
  onStateChange: idle => {
    isScrollIdle.value = idle;
  },
});
let listenerCount = 0;

function startScrollIdleListeners(): void {
  if (listenerCount++ > 0) return;
  scrollIdleApi.start();
}

function stopScrollIdleListeners(): void {
  if (--listenerCount > 0) return;
  scrollIdleApi.stop();
}

/**
 * Shared scroll-idle ref for deferring map mounts during scroll (e.g. card grids).
 * Host calls start()/stop() when a shared scroll context mounts (e.g. map collection).
 */
export function useGkScrollIdle(idleMs = DEFAULT_IDLE_MS) {
  if (idleMs !== DEFAULT_IDLE_MS) {
    // Per-call idleMs would need separate instances; default is 350ms.
  }
  return {
    isScrollIdle: readonly(isScrollIdle),
    start: startScrollIdleListeners,
    stop: stopScrollIdleListeners,
  };
}
