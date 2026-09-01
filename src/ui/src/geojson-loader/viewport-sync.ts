type MapEventLike = {
  on?: (event: string, handler: () => void) => void;
  off?: (event: string, handler: () => void) => void;
};

export function bindIncrementalViewportSync(options: {
  map: MapEventLike;
  load: () => void | Promise<void>;
  moveThrottleMs?: number;
  moveEndDebounceMs?: number;
}): () => void {
  const moveThrottleMs = options.moveThrottleMs ?? 200;
  const moveEndDebounceMs = options.moveEndDebounceMs ?? 100;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let loadInflight: Promise<void> | null = null;
  let loadQueued = false;

  const runLoad = (): Promise<void> => {
    if (loadInflight) {
      loadQueued = true;
      return loadInflight;
    }
    loadInflight = (async () => {
      do {
        loadQueued = false;
        await options.load();
      } while (loadQueued);
    })().finally(() => {
      loadInflight = null;
    });
    return loadInflight;
  };

  const schedule = (delay: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void runLoad();
    }, delay);
  };

  const onMove = () => schedule(moveThrottleMs);
  const onSettled = () => schedule(moveEndDebounceMs);

  options.map.on?.('move', onMove);
  options.map.on?.('moveend', onSettled);
  options.map.on?.('zoomend', onSettled);

  void runLoad();

  return () => {
    if (timer) clearTimeout(timer);
    options.map.off?.('move', onMove);
    options.map.off?.('moveend', onSettled);
    options.map.off?.('zoomend', onSettled);
  };
}

export function bindDebouncedMapMoveend(
  map: MapEventLike,
  load: () => void | Promise<void>,
  debounceMs: number
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void load();
    }, debounceMs);
  };

  map.on?.('moveend', schedule);

  return () => {
    if (timer) clearTimeout(timer);
    map.off?.('moveend', schedule);
  };
}
