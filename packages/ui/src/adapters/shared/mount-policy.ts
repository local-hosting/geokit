import { createScrollIdle } from '../../utils/scroll-idle.js';
import type { MapMountMode, MapMountPolicy, MapMountPolicyOptions } from './types.js';

const DEFAULT_SCROLL_IDLE_MS = 350;
const DEFAULT_VISIBLE_STABLE_MS = 200;

function resolveMode(mode: MapMountMode | undefined): MapMountMode {
  return mode ?? 'when-visible-and-idle';
}

/**
 * Intersection + optional scroll-idle gate for deferring gk-map mount.
 * Card-grid mount gate: visible + optional scroll idle + stable delay.
 */
export function createMapMountPolicy(options: MapMountPolicyOptions = {}): MapMountPolicy {
  const mode = resolveMode(options.mode);
  const scrollIdleMs = options.scrollIdleMs ?? DEFAULT_SCROLL_IDLE_MS;
  const visibleStableMs = options.visibleStableMs ?? DEFAULT_VISIBLE_STABLE_MS;
  const rootMargin = options.rootMargin ?? '0px';
  const threshold = options.threshold ?? 0;
  const stickyMount = options.stickyMount ?? false;

  let container: HTMLElement | null = null;
  let observer: IntersectionObserver | null = null;
  let scrollIdle: ReturnType<typeof createScrollIdle> | null = null;
  let unsubscribeScrollIdle: (() => void) | null = null;
  let visibleStableTimer: ReturnType<typeof setTimeout> | null = null;
  let forced = false;
  let isVisible = mode === 'immediate';
  let isScrollIdle =
    mode !== 'when-visible-and-idle' ? true : (options.getScrollIdle?.() ?? true);
  let shouldMount = mode === 'immediate';

  function notify(): void {
    options.onVisibleChange?.(isVisible);
    options.onScrollIdleChange?.(isScrollIdle);
    options.onShouldMountChange?.(shouldMount);
  }

  function clearVisibleStableTimer(): void {
    if (visibleStableTimer) {
      clearTimeout(visibleStableTimer);
      visibleStableTimer = null;
    }
  }

  function setShouldMount(next: boolean): void {
    if (stickyMount && shouldMount && !next) return;
    if (next === shouldMount) return;
    shouldMount = next;
    options.onShouldMountChange?.(shouldMount);
  }

  function recomputeShouldMount(): void {
    const next =
      forced ||
      mode === 'immediate' ||
      (isVisible && (mode === 'when-visible' || isScrollIdle));
    setShouldMount(next);
  }

  function scheduleVisibleStableMount(): void {
    clearVisibleStableTimer();
    if (mode === 'immediate' || forced) {
      recomputeShouldMount();
      return;
    }
    if (!isVisible) {
      if (shouldMount && !stickyMount) setShouldMount(false);
      return;
    }
    if (visibleStableMs <= 0) {
      recomputeShouldMount();
      return;
    }
    visibleStableTimer = setTimeout(() => {
      visibleStableTimer = null;
      recomputeShouldMount();
    }, visibleStableMs);
  }

  function setVisible(next: boolean): void {
    if (next === isVisible) return;
    isVisible = next;
    options.onVisibleChange?.(isVisible);
    scheduleVisibleStableMount();
  }

  function setScrollIdle(next: boolean): void {
    if (next === isScrollIdle) return;
    isScrollIdle = next;
    options.onScrollIdleChange?.(isScrollIdle);
    if (isScrollIdle) scheduleVisibleStableMount();
  }

  return {
    start(nextContainer: HTMLElement): void {
      this.stop();
      container = nextContainer;

      if (mode === 'immediate') {
        isVisible = true;
        isScrollIdle = true;
        shouldMount = true;
        notify();
        return;
      }

      isVisible = false;
      isScrollIdle = mode !== 'when-visible-and-idle';
      shouldMount = false;
      notify();

      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries.find((e) => e.target === container);
          if (entry) setVisible(entry.isIntersecting);
        },
        { root: null, rootMargin, threshold }
      );
      observer.observe(container);

      if (mode === 'when-visible-and-idle') {
        if (options.subscribeScrollIdle) {
          unsubscribeScrollIdle = options.subscribeScrollIdle(setScrollIdle);
        } else {
          scrollIdle = createScrollIdle({
            idleMs: scrollIdleMs,
            onStateChange: setScrollIdle,
          });
          scrollIdle.start();
        }
      }
    },

    stop(): void {
      clearVisibleStableTimer();
      observer?.disconnect();
      observer = null;
      scrollIdle?.stop();
      scrollIdle = null;
      unsubscribeScrollIdle?.();
      unsubscribeScrollIdle = null;
      container = null;
    },

    forceMount(): void {
      forced = true;
      isVisible = true;
      isScrollIdle = true;
      clearVisibleStableTimer();
      shouldMount = true;
      options.onShouldMountChange?.(true);
    },

    getIsVisible: () => isVisible,
    getIsScrollIdle: () => isScrollIdle,
    getShouldMount: () => shouldMount,
  };
}
