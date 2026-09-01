import { useEffect, useRef } from 'react';
import { bindGkMapContainerLifecycle } from '../shared/container-lifecycle';
import type { GkMapContainerHandlers } from '../shared/container-lifecycle';

/** Container-scoped gk-map ready / unload / unfreeze (map pool). */
export function useGkMapContainer(
  container: HTMLElement | null,
  handlers: GkMapContainerHandlers
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(
    () =>
      bindGkMapContainerLifecycle(container, {
        onReady: detail => handlersRef.current.onReady?.(detail),
        onUnload: detail => handlersRef.current.onUnload?.(detail),
        onUnfreeze: detail => handlersRef.current.onUnfreeze?.(detail),
      }),
    [container]
  );
}
