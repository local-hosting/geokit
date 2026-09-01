import { onUnmounted, unref, watch, type ComputedRef, type Ref } from 'vue';
import {
  onGkMapReadyOnce,
  type GkMapReadyOnceOptions,
} from '../shared/map-document-events';

export type UseGkMapReadyOnceOptions = Omit<GkMapReadyOnceOptions, 'onReady'> & {
  onReady: (event: Event) => void;
  enabled?: Ref<boolean> | ComputedRef<boolean> | boolean;
};

/** Vue wrapper for first gk-map-ready (with optional filter + timeout). */
export function useGkMapReadyOnce(options: UseGkMapReadyOnceOptions) {
  let cleanup: (() => void) | null = null;

  const attach = () => {
    cleanup?.();
    cleanup = onGkMapReadyOnce({
      onReady: options.onReady,
      filter: options.filter,
      timeoutMs: options.timeoutMs,
      target: options.target,
    });
  };

  const stop = () => {
    cleanup?.();
    cleanup = null;
  };

  if (options.enabled !== undefined && typeof options.enabled === 'object') {
    watch(
      () => unref(options.enabled!),
      enabled => {
        if (enabled) attach();
        else stop();
      },
      { immediate: true }
    );
  } else if (options.enabled === false) {
    // no-op
  } else {
    attach();
  }

  onUnmounted(stop);

  return { stop, listen: attach };
}
