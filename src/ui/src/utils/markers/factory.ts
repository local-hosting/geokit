import type { MapInstance } from '../../providers/types';

export type MarkerPhase = 'rest' | 'hover' | 'selected';

export type MarkerState<TVariant extends string> =
  | { phase: 'rest' | 'hover' }
  | { phase: 'selected'; variant: TVariant; accentColor: string };

export type MarkerPreset<TVariant extends string, TIds, TPaint extends { ids: TIds }> = {
  presetId: string;
  inventory: {
    layerStack(ids: TIds): readonly string[];
    sourceStack(ids: TIds): readonly string[];
  };
  paint: {
    build(ids: TIds, options: Record<string, unknown>): TPaint;
  };
  features: {
    variantFrom(properties: Record<string, unknown> | null | undefined): TVariant;
    accentFrom(
      properties: Record<string, unknown> | null | undefined,
      fallbackAccent: string
    ): string;
    readSelection?(map: MapInstance, sourceId: string): Record<string, unknown> | null;
  };
  states: {
    apply(map: MapInstance, ids: TIds, state: MarkerState<TVariant>): void;
  };
};

export type Marker<TVariant extends string, TIds, TPaint extends { ids: TIds }> = {
  presetId: string;
  ids: TIds;
  layerStack(): readonly string[];
  sourceStack(): readonly string[];
  buildPaintConfig(): TPaint;
  variantFrom(properties: Record<string, unknown> | null | undefined): TVariant;
  accentFrom(properties: Record<string, unknown> | null | undefined, fallbackAccent?: string): string;
  applyState(map: MapInstance, state: MarkerState<TVariant>): void;
};

export function createMarker<TVariant extends string, TIds extends { sourceId: string }, TPaint extends { ids: TIds }>(
  preset: MarkerPreset<TVariant, TIds, TPaint>,
  options: { ids: TIds; fallbackAccent: string; paintOptions?: Record<string, unknown> }
): Marker<TVariant, TIds, TPaint> {
  const { ids, fallbackAccent } = options;
  const paintOpts = { fallbackAccent, ...options.paintOptions };

  const marker: Marker<TVariant, TIds, TPaint> = {
    presetId: preset.presetId,
    ids,
    layerStack: () => preset.inventory.layerStack(ids),
    sourceStack: () => preset.inventory.sourceStack(ids),
    buildPaintConfig: () => preset.paint.build(ids, paintOpts),
    variantFrom: (p) => preset.features.variantFrom(p),
    accentFrom: (p, fb = fallbackAccent) => preset.features.accentFrom(p, fb),
    applyState: (map, state) => preset.states.apply(map, ids, state),
  };

  return marker;
}

/** @deprecated Renamed — use `createMarker` / `MarkerPreset` / `MarkerState`. */
export const createMarkerFactory = createMarker;
export type MarkerFactoryAspects<T extends string, I, P extends { ids: I }> = MarkerPreset<T, I, P>;
export type MarkerFactory<T extends string, I, P extends { ids: I }> = Marker<T, I, P>;
export type MarkerInteractionPhase = MarkerPhase;
export type MarkerInteractionState<T extends string> = MarkerState<T>;