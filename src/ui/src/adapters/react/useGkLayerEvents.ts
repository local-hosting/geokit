import { useEffect, useRef } from 'react';

export type GkLayerEventHandlers = Record<string, (event: Event) => void>;

/** Bind events on a descendant gk-layer inside a root element. */
export function useGkLayerEvents(
  root: HTMLElement | null,
  selector: string,
  handlers: GkLayerEventHandlers
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const el = root?.querySelector(selector) ?? null;
    if (!el) return;

    const unsubs: Array<() => void> = [];
    for (const [type, handler] of Object.entries(handlersRef.current)) {
      const listener = handler as EventListener;
      el.addEventListener(type, listener);
      unsubs.push(() => el.removeEventListener(type, listener));
    }

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [root, selector]);
}
