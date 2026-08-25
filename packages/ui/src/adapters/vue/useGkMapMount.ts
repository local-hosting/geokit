import { onUnmounted, ref, watch, type Ref } from 'vue';
import { createMapMountPolicy } from '../shared/mount-policy.js';
import type { MapMountPolicyOptions } from '../shared/types.js';

export type UseGkMapMountOptions = MapMountPolicyOptions & {
  /** App-wide scroll idle ref from a host scroll gate composable. */
  scrollIdleRef?: Ref<boolean>;
};

/** Defer gk-map mount until visible (and optionally scroll-idle). */
export function useGkMapMount(
  containerRef: Ref<HTMLElement | null>,
  options: UseGkMapMountOptions = {}
) {
  const { scrollIdleRef, ...policyOptions } = options;
  const shouldMount = ref(options.mode === 'immediate');
  const isVisible = ref(options.mode === 'immediate');
  const isScrollIdle = ref(
    options.mode !== 'when-visible-and-idle' ? true : (scrollIdleRef?.value ?? true)
  );

  const policy = createMapMountPolicy({
    ...policyOptions,
    stickyMount: policyOptions.stickyMount ?? policyOptions.mode !== 'immediate',
    getScrollIdle: scrollIdleRef ? () => scrollIdleRef.value : policyOptions.getScrollIdle,
    subscribeScrollIdle: scrollIdleRef
      ? (listener) => watch(scrollIdleRef, listener, { immediate: true })
      : policyOptions.subscribeScrollIdle,
    onShouldMountChange: (value) => {
      shouldMount.value = value;
    },
    onVisibleChange: (value) => {
      isVisible.value = value;
    },
    onScrollIdleChange: (value) => {
      isScrollIdle.value = value;
    },
  });

  watch(
    containerRef,
    (container) => {
      policy.stop();
      if (!container) return;
      policy.start(container);
    },
    { immediate: true }
  );

  onUnmounted(() => policy.stop());

  function requestRemount(): void {
    if (!shouldMount.value) {
      policy.forceMount();
      return;
    }
    shouldMount.value = false;
    queueMicrotask(() => {
      policy.forceMount();
    });
  }

  return {
    shouldMount,
    isVisible,
    isScrollIdle,
    forceMount: () => policy.forceMount(),
    requestRemount,
  };
}
