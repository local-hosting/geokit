/** Document-level gk-map event subscriptions. */

export function onGkMapReadyDocument(
  handler: (event: Event) => void,
  target: EventTarget = document
): () => void {
  if (typeof document === 'undefined') return () => {};
  const listener = handler as EventListener;
  target.addEventListener('gk-map-ready', listener);
  return () => target.removeEventListener('gk-map-ready', listener);
}

export type GkMapReadyOnceOptions = {
  onReady: (event: Event) => void;
  filter?: (event: Event) => boolean;
  timeoutMs?: number;
  target?: EventTarget;
};

/** First matching gk-map-ready (optional timeout fallback). */
export function onGkMapReadyOnce(options: GkMapReadyOnceOptions): () => void {
  const target = options.target ?? document;
  if (typeof document === 'undefined') return () => {};

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const stop = onGkMapReadyDocument((event) => {
    if (stopped) return;
    if (options.filter && !options.filter(event)) return;
    cleanup();
    options.onReady(event);
  }, target);

  function cleanup(): void {
    if (stopped) return;
    stopped = true;
    stop();
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  if (options.timeoutMs && options.timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      if (stopped) return;
      cleanup();
      options.onReady(new Event('gk-map-ready-timeout'));
    }, options.timeoutMs);
  }

  return cleanup;
}
