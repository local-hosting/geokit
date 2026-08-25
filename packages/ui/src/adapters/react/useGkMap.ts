import { useCallback, useEffect, useRef, useState } from 'react';
import { bindGkMapLifecycle } from '../shared/map-lifecycle';
import type { GkMapElement, GkMapLifecycleHandlers } from '../shared/types';

export type UseGkMapOptions = GkMapLifecycleHandlers;

export type UseGkMapReturn = {
  mapElement: GkMapElement | null;
  mapInstance: unknown;
  isReady: boolean;
  setMapElement: (element: GkMapElement | null) => void;
};

/** Track a gk-map element via callback ref. */
export function useGkMap(options: UseGkMapOptions = {}): UseGkMapReturn {
  const [mapElement, setMapElementState] = useState<GkMapElement | null>(null);
  const [mapInstance, setMapInstance] = useState<unknown>(null);
  const [isReady, setIsReady] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const setMapElement = useCallback((element: GkMapElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setMapElementState(element);
    setMapInstance(null);
    setIsReady(false);
    if (!element) return;

    cleanupRef.current = bindGkMapLifecycle(element, {
      onReady: async (detail) => {
        setMapElementState(detail.element);
        setMapInstance(detail.map);
        setIsReady(true);
        detail.element.hidePlaceholder?.();
        await optionsRef.current.onReady?.(detail);
      },
      onUnload: (detail) => {
        setIsReady(false);
        setMapInstance(null);
        optionsRef.current.onUnload?.(detail);
      },
      onFreeze: optionsRef.current.onFreeze,
      onUnfreeze: async (detail) => {
        setMapInstance(detail.map);
        setIsReady(true);
        await optionsRef.current.onUnfreeze?.(detail);
      },
      onFailed: (detail) => {
        setIsReady(false);
        optionsRef.current.onFailed?.(detail);
      },
      onStuck: optionsRef.current.onStuck,
    });
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  return { mapElement, mapInstance, isReady, setMapElement };
}
