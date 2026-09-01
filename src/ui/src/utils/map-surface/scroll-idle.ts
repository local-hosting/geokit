/**
 * Scroll-idle observer (framework-agnostic).
 *
 * Fires when the user has not scrolled for a given delay. Use to defer work
 * (e.g. activating map cards) until scroll stops, so UIs feel responsive.
 *
 * @example
 * // Vanilla
 * const scrollIdle = createScrollIdle({ idleMs: 350, onStateChange: (isIdle) => { ... } });
 * scrollIdle.start();
 * // on unmount: scrollIdle.stop();
 *
 * @example
 * // Vue: useScrollIdle can wrap this and expose a ref
 */

export interface ScrollIdleOptions {
  /** Milliseconds without scroll/wheel/touchmove before considered idle. */
  idleMs: number;
  /** Called when idle state changes (true = idle, false = scrolling). */
  onStateChange?: (isIdle: boolean) => void;
}

export interface ScrollIdleApi {
  start(): void;
  stop(): void;
  /** Current idle state (true after idleMs of no scroll). */
  getIsIdle(): boolean;
}

const DEFAULT_IDLE_MS = 350;

/**
 * Create a scroll-idle observer. Call start() when the scroll context is active
 * (e.g. grid is visible) and stop() when unmounting so listeners are removed.
 */
export function createScrollIdle(options: ScrollIdleOptions): ScrollIdleApi {
  const idleMs = options.idleMs ?? DEFAULT_IDLE_MS;
  const onStateChange = options.onStateChange;

  let isIdle = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let listenerCount = 0;

  function setIdle(value: boolean): void {
    if (value === isIdle) return;
    isIdle = value;
    onStateChange?.(isIdle);
  }

  function onScroll(): void {
    setIdle(false);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      setIdle(true);
    }, idleMs);
  }

  function start(): void {
    if (listenerCount++ > 0) return;
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onScroll, { passive: true });
    window.addEventListener('touchmove', onScroll, { passive: true });
  }

  function stop(): void {
    if (--listenerCount > 0) return;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('wheel', onScroll);
    window.removeEventListener('touchmove', onScroll);
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    setIdle(true);
  }

  return {
    start,
    stop,
    getIsIdle: () => isIdle,
  };
}
