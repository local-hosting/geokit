import { useEffect, useRef } from 'react';
import type { GkPointEventHandlers } from '../../ui/utils/map-events.js';
import { bindGkMapPointEventsLifecycle } from '../shared/point-events-lifecycle.js';

/** Lifecycle-aware gk-point-* binding for maps inside a container (pool-safe). */
export function useGkMapPointEvents(
  container: HTMLElement | null,
  handlers: GkPointEventHandlers
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    return bindGkMapPointEventsLifecycle(container, {
      onClick: detail => handlersRef.current.onClick?.(detail),
      onHover: detail => handlersRef.current.onHover?.(detail),
      onHoverEnd: detail => handlersRef.current.onHoverEnd?.(detail),
      onFocus: event => handlersRef.current.onFocus?.(event),
      onBlur: event => handlersRef.current.onBlur?.(event),
    });
  }, [container]);
}
