export type GkLayerEventHandlers = Record<string, (event: Event) => void>;

/** Bind events on a descendant gk-layer inside a root element. */
export function createGkLayerEvents(
  getRoot: () => HTMLElement | null,
  selector: string,
  handlers: GkLayerEventHandlers
) {
  let _target: Element | null = null;
  const unsubs: Array<() => void> = [];

  function cleanup(): void {
    for (const unsub of unsubs) unsub();
    unsubs.length = 0;
    _target = null;
  }

  return {
    bind() {
      cleanup();
      const el = getRoot()?.querySelector(selector) ?? null;
      if (!el) return;
      _target = el;
      for (const [type, handler] of Object.entries(handlers)) {
        const listener = handler as EventListener;
        el.addEventListener(type, listener);
        unsubs.push(() => el.removeEventListener(type, listener));
      }
    },
    stop: cleanup,
    destroy: cleanup,
  };
}
