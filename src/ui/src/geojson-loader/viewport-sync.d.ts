type MapEventLike = {
    on?: (event: string, handler: () => void) => void;
    off?: (event: string, handler: () => void) => void;
};
export declare function bindIncrementalViewportSync(options: {
    map: MapEventLike;
    load: () => void | Promise<void>;
    moveThrottleMs?: number;
    moveEndDebounceMs?: number;
}): () => void;
export declare function bindDebouncedMapMoveend(map: MapEventLike, load: () => void | Promise<void>, debounceMs: number): () => void;
export {};
//# sourceMappingURL=viewport-sync.d.ts.map