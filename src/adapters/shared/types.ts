/**
 * Framework adapter types — shared across Vue, React, and Svelte.
 */

/** gk-map element surface used by host apps and adapters. */
export type GkMapElement = HTMLElement & {
  getMap(): unknown;
  hasSource?(sourceId: string): boolean;
  hasLayer?(layerId: string): boolean;
  hidePlaceholder?(): void;
  freeze?(): Promise<void>;
  whenStyleReady?(timeout?: number): Promise<void>;
  setSelectedPoint?(
    sourceId: string,
    featureId: string | null,
    lngLat?: { lng: number; lat: number } | null,
    idProperties?: string[]
  ): boolean;
  clearSelectedPoint?(sourceId?: string): boolean;
  updateSourceData?(
    sourceId: string,
    data: { type: 'FeatureCollection'; features: unknown[] }
  ): boolean;
};

export type GkMapLifecycleDetail = {
  element: GkMapElement;
  map: unknown;
};

export type GkMapLifecycleHandlers = {
  onReady?: (detail: GkMapLifecycleDetail) => void | Promise<void>;
  onUnload?: (detail: GkMapLifecycleDetail) => void;
  onFreeze?: (detail: GkMapLifecycleDetail) => void | Promise<void>;
  onUnfreeze?: (detail: GkMapLifecycleDetail) => void | Promise<void>;
  onFailed?: (detail: GkMapLifecycleDetail & { error?: unknown }) => void;
  onStuck?: (detail: GkMapLifecycleDetail) => void;
};

export type MapMountMode = 'immediate' | 'when-visible' | 'when-visible-and-idle';

export type MapMountPolicyOptions = {
  mode?: MapMountMode;
  scrollIdleMs?: number;
  visibleStableMs?: number;
  rootMargin?: string;
  threshold?: number | number[];
  onShouldMountChange?: (shouldMount: boolean) => void;
  onVisibleChange?: (isVisible: boolean) => void;
  onScrollIdleChange?: (isScrollIdle: boolean) => void;
  /** Once shouldMount is true, never flip back to false (card grids). */
  stickyMount?: boolean;
  /** App-wide scroll idle from a host scroll gate. Skips internal window listener. */
  subscribeScrollIdle?: (listener: (isIdle: boolean) => void) => () => void;
  getScrollIdle?: () => boolean;
};

export type MapMountPolicy = {
  start(container: HTMLElement): void;
  stop(): void;
  forceMount(): void;
  getIsVisible(): boolean;
  getIsScrollIdle(): boolean;
  getShouldMount(): boolean;
};
