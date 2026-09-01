import { useCallback, useEffect, useRef, useState } from 'react';
import { createMapMountPolicy } from '../shared/mount-policy';
import type { MapMountPolicyOptions } from '../shared/types';

export type UseGkMapMountOptions = MapMountPolicyOptions & {
  /** App-wide scroll idle from useGkScrollIdle(). */
  isScrollIdle?: boolean;
};

/** Defer gk-map mount until visible (and optionally scroll-idle). */
export function useGkMapMount(
  container: HTMLElement | null,
  options: UseGkMapMountOptions = {}
) {
  const { isScrollIdle, ...policyOptions } = options;
  const [shouldMount, setShouldMount] = useState(options.mode === 'immediate');
  const [isVisible, setIsVisible] = useState(options.mode === 'immediate');
  const [scrollIdle, setScrollIdle] = useState(
    options.mode !== 'when-visible-and-idle' ? true : (isScrollIdle ?? true)
  );
  const policyRef = useRef<ReturnType<typeof createMapMountPolicy> | null>(null);

const requestRemount = useCallback(() => {
    const policy = policyRef.current;
    if (!policy) return;
    if (!policy.getShouldMount()) {
      policy.forceMount();
      return;
    }
    setShouldMount(false);
    queueMicrotask(() => policy.forceMount());
  }, []);

  useEffect(() => {
    const policy = createMapMountPolicy({
      ...policyOptions,
      stickyMount: policyOptions.stickyMount ?? policyOptions.mode !== 'immediate',
      getScrollIdle: isScrollIdle !== undefined ? () => isScrollIdle : policyOptions.getScrollIdle,
      onShouldMountChange: setShouldMount,
      onVisibleChange: setIsVisible,
      onScrollIdleChange: setScrollIdle,
    });
    policyRef.current = policy;
    if (container) policy.start(container);
    return () => policy.stop();
  }, [
    container,
    policyOptions.mode,
    policyOptions.scrollIdleMs,
    policyOptions.visibleStableMs,
    policyOptions.rootMargin,
    policyOptions.threshold,
    policyOptions.stickyMount,
    isScrollIdle,
  ]);

  return {
    shouldMount,
    isVisible,
    isScrollIdle: scrollIdle,
    forceMount: () => policyRef.current?.forceMount(),
    requestRemount,
  };
}
