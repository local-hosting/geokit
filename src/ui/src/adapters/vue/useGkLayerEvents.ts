import { onUnmounted, watch, type Ref } from 'vue';

export type GkLayerEventHandlers = Record<string, (event: Event) => void>;

/**
 * Bind events on a descendant gk-layer (or other element) inside a root ref.
 * Rebinds when root or selector changes.
 */
export function useGkLayerEvents(
  root: Ref<HTMLElement | null>,
  selector: string,
  handlers: GkLayerEventHandlers
): void {
  let _target: Element | null = null;
  const unsubs: Array<() => void> = [];

  function cleanup(): void {
    for (const unsub of unsubs) unsub();
    unsubs.length = 0;
    _target = null;
  }

  function bind(): void {
    cleanup();
    const el = root.value?.querySelector(selector) ?? null;
    if (!el) return;
    _target = el;
    for (const [type, handler] of Object.entries(handlers)) {
      const listener = handler as EventListener;
      el.addEventListener(type, listener);
      unsubs.push(() => el.removeEventListener(type, listener));
    }
  }

  watch(root, bind, { immediate: true });
  onUnmounted(cleanup);
}
