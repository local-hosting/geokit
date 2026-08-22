import {
  onGkMapReadyOnce,
  type GkMapReadyOnceOptions,
} from '../shared/map-document-events.js';

export type CreateGkMapReadyOnceOptions = GkMapReadyOnceOptions & {
  getEnabled?: () => boolean;
};

/** First gk-map-ready (optional filter + timeout). */
export function createGkMapReadyOnce(options: CreateGkMapReadyOnceOptions) {
  let cleanup: (() => void) | null = null;

  return {
    start() {
      this.stop();
      if (options.getEnabled?.() === false) return;
      cleanup = onGkMapReadyOnce(options);
    },
    stop() {
      cleanup?.();
      cleanup = null;
    },
    destroy() {
      this.stop();
    },
  };
}
