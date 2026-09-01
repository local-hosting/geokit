import { useEffect, useRef } from 'react';
import {
  onGkMapReadyOnce,
  type GkMapReadyOnceOptions,
} from '../shared/map-document-events';

export type UseGkMapReadyOnceOptions = GkMapReadyOnceOptions & {
  enabled?: boolean;
};

/** React wrapper for first gk-map-ready (with optional filter + timeout). */
export function useGkMapReadyOnce(options: UseGkMapReadyOnceOptions): void {
  const { enabled = true, onReady, filter, timeoutMs, target } = options;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!enabled) return;
    return onGkMapReadyOnce({
      onReady: event => onReadyRef.current(event),
      filter,
      timeoutMs,
      target,
    });
  }, [enabled, filter, timeoutMs, target]);
}
