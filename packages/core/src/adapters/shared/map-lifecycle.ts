import type { GkMapElement, GkMapLifecycleDetail, GkMapLifecycleHandlers } from './types.js';

const LIFECYCLE_EVENTS = {
  ready: 'gk-map-ready',
  unload: 'gk-map-unload',
  freeze: 'gk-map-freeze',
  unfreeze: 'gk-map-unfreeze',
  failed: 'gk-map-failed',
  stuck: 'gk-map-stuck',
} as const;

function detailFromEvent(event: Event): GkMapLifecycleDetail & { error?: unknown } {
  const custom = event as CustomEvent<{
    element?: GkMapElement;
    map?: unknown;
    error?: unknown;
  }>;
  const element = (custom.detail?.element ?? event.currentTarget ?? event.target) as GkMapElement;
  const map =
    custom.detail?.map ??
    (typeof element?.getMap === 'function' ? element.getMap() : null);
  return { element, map };
}

function bindLifecycleEvent(
  target: EventTarget,
  type: string,
  handler: ((detail: GkMapLifecycleDetail & { error?: unknown }) => void | Promise<void>) | undefined
): (() => void) | undefined {
  if (!handler) return undefined;

  const listener = (event: Event): void => {
    void handler(detailFromEvent(event));
  };

  target.addEventListener(type, listener as EventListener);
  return () => target.removeEventListener(type, listener as EventListener);
}

/**
 * Subscribe to gk-map lifecycle events on a single map element.
 * Returns teardown — call on unmount or before rebinding a new element.
 */
export function bindGkMapLifecycle(
  element: HTMLElement | null,
  handlers: GkMapLifecycleHandlers
): () => void {
  if (!element) return () => {};

  const unsubs = [
    bindLifecycleEvent(element, LIFECYCLE_EVENTS.ready, handlers.onReady),
    bindLifecycleEvent(element, LIFECYCLE_EVENTS.unload, handlers.onUnload),
    bindLifecycleEvent(element, LIFECYCLE_EVENTS.freeze, handlers.onFreeze),
    bindLifecycleEvent(element, LIFECYCLE_EVENTS.unfreeze, handlers.onUnfreeze),
    bindLifecycleEvent(element, LIFECYCLE_EVENTS.failed, handlers.onFailed),
    bindLifecycleEvent(element, LIFECYCLE_EVENTS.stuck, handlers.onStuck),
  ].filter((fn): fn is () => void => Boolean(fn));

  return () => {
    for (const unsub of unsubs) unsub();
  };
}
