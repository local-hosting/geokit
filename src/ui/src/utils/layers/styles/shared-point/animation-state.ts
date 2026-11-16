import type { MapInstance } from '../../../../providers/types';

export type HoverRingColorTarget = 'hover' | 'selection';
export const selectionBadgeAnimByMap = new WeakMap<MapInstance, Map<string, number>>();
export const hoverBadgeAnimByMap = new WeakMap<MapInstance, Map<string, number>>();
export const hoverRingColorAnimByMap = new WeakMap<MapInstance, Map<string, number>>();
