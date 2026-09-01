import { useSyncExternalStore } from 'react';
import { createScrollIdle } from '../../utils/scroll-idle';

const DEFAULT_IDLE_MS = 350;

let isScrollIdle = true;
let listenerCount = 0;
const subscribers = new Set<() => void>();

const scrollIdleApi = createScrollIdle({
  idleMs: DEFAULT_IDLE_MS,
  onStateChange: idle => {
    isScrollIdle = idle;
    for (const notify of subscribers) notify();
  },
});

function subscribe(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function getSnapshot(): boolean {
  return isScrollIdle;
}

function startScrollIdleListeners(): void {
  if (listenerCount++ > 0) return;
  scrollIdleApi.start();
}

function stopScrollIdleListeners(): void {
  if (--listenerCount > 0) return;
  scrollIdleApi.stop();
}

/** Shared scroll-idle state for deferring map mounts during scroll (e.g. card grids). */
export function useGkScrollIdle() {
  const idle = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    isScrollIdle: idle,
    start: startScrollIdleListeners,
    stop: stopScrollIdleListeners,
  };
}
