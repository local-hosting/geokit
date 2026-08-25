import { createElement, forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import type { GkMapElement } from '../shared/types.js';

export type GkMapProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode;
};

/** Thin React wrapper around the gk-map custom element. */
export const GkMap = forwardRef<GkMapElement, GkMapProps>(function GkMap(props, ref) {
  const { children, ...rest } = props;
  return createElement('gk-map', { ref, ...rest }, children);
});
