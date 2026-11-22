import { computed, ref, shallowRef, watch, type ComputedRef, type Ref, type ShallowRef } from 'vue';
import type { MapCameraScopeViewport } from '@local-hosting/geokit/h3/map-camera-scope-cells';
import type { MapViewportSizePx } from '@local-hosting/geokit/h3/map-viewport-h3';

import {
  bindMapViewScopeSaveHover,
  mapViewScopeControlActionsJson,
  resolveCommittedMapViewScopeViewport,
  resolveMapViewScopeInnerCell,
  resolveMapViewScopeOuterCell,
  hasMeasuredMapViewport,
  resolveShowCommittedMapViewScopeOverlays,
  resolveTentativeMapViewScopeViewport,
} from '../../map-view-scope';
import {
  coreGkH3PaintForTheme,
  outerRegionGkH3PaintForTheme,
  tentativeInnerGkH3PaintForTheme,
  tentativeOuterGkH3PaintForTheme,
} from '../../utils/gk-h3-scope-paint';
import { syncGkH3PaintAttributes } from '../../utils/sync-gk-map-child-attributes';

export type UseGkMapViewScopeOptions = {
  gkMapEl: Ref<HTMLElement | null>;
  geoScopeCell: Ref<string | null | undefined>;
  savedCamera: Ref<MapCameraScopeViewport | null | undefined>;
  liveCamera: Ref<MapCameraScopeViewport | null | undefined>;
  viewDirty: Ref<boolean>;
  controlsEnabled: Ref<boolean> | ComputedRef<boolean>;
  theme: Ref<string> | ComputedRef<string>;
  accentHex?: Ref<string | null | undefined> | ComputedRef<string | null | undefined>;
  /** Live map canvas size — outer shell fits the visible map frame when set. */
  viewportSizePx?: Ref<MapViewportSizePx | null | undefined>;
};

export type UseGkMapViewScopeReturn = {
  savePreviewHover: Ref<boolean>;
  committedScopeViewport: ComputedRef<MapCameraScopeViewport | null>;
  innerH3Cell: ComputedRef<string | null>;
  outerH3Cell: ComputedRef<string | null>;
  tentativeInnerH3Cell: ComputedRef<string | null>;
  tentativeOuterH3Cell: ComputedRef<string | null>;
  showCommittedScopeOverlays: ComputedRef<boolean>;
  showTentativeScopePreview: ComputedRef<boolean>;
  showViewActions: ComputedRef<boolean>;
  viewActionsJson: ComputedRef<string>;
  committedInnerGkH3El: ShallowRef<HTMLElement | null>;
  committedOuterGkH3El: ShallowRef<HTMLElement | null>;
  tentativeInnerGkH3El: ShallowRef<HTMLElement | null>;
  tentativeOuterGkH3El: ShallowRef<HTMLElement | null>;
  clearSavePreviewHover: () => void;
};

/**
 * Map view-scope UI: save/snap control visibility, committed vs tentative `gk-h3` overlays.
 * Persistence stays in the host (`commit` / `revert` handlers on `gk-control-actions`).
 */
export function useGkMapViewScope(options: UseGkMapViewScopeOptions): UseGkMapViewScopeReturn {
  const savePreviewHover = ref(false);

  const committedScopeViewport = computed(() =>
    resolveCommittedMapViewScopeViewport({
      savedCamera: options.savedCamera.value,
      liveCamera: options.liveCamera.value,
    }),
  );

  const tentativeScopeViewport = computed(() =>
    resolveTentativeMapViewScopeViewport({
      viewDirty: options.viewDirty.value,
      savePreviewHover: savePreviewHover.value,
      liveCamera: options.liveCamera.value,
    }),
  );

  const viewportSizePx = computed(() => options.viewportSizePx?.value ?? null);

  const showCommittedScopeOverlays = computed(() =>
    resolveShowCommittedMapViewScopeOverlays({
      savedCamera: options.savedCamera.value,
      viewDirty: options.viewDirty.value,
      viewportSizePx: viewportSizePx.value,
    }),
  );

  const innerH3Cell = computed(() => {
    if (!showCommittedScopeOverlays.value) return null;
    return resolveMapViewScopeInnerCell(
      options.geoScopeCell.value,
      committedScopeViewport.value,
      viewportSizePx.value,
    );
  });

  const outerH3Cell = computed(() => {
    if (!showCommittedScopeOverlays.value) return null;
    return resolveMapViewScopeOuterCell(
      options.geoScopeCell.value,
      committedScopeViewport.value,
      viewportSizePx.value,
    );
  });

  const tentativeInnerH3Cell = computed(() =>
    tentativeScopeViewport.value
      ? resolveMapViewScopeInnerCell(
          options.geoScopeCell.value,
          tentativeScopeViewport.value,
          viewportSizePx.value,
        )
      : null,
  );

  const tentativeOuterH3Cell = computed(() =>
    tentativeScopeViewport.value
      ? resolveMapViewScopeOuterCell(
          options.geoScopeCell.value,
          tentativeScopeViewport.value,
          viewportSizePx.value,
        )
      : null,
  );

  const showTentativeScopePreview = computed(
    () => Boolean(tentativeScopeViewport.value) && hasMeasuredMapViewport(viewportSizePx.value),
  );

  const showViewActions = computed(
    () => options.viewDirty.value && Boolean(options.controlsEnabled.value),
  );

  const viewActionsJson = computed(() => mapViewScopeControlActionsJson());

  const accent = computed(() => options.accentHex?.value ?? null);
  const theme = computed(() => options.theme.value);

  const committedCorePaint = computed(() => coreGkH3PaintForTheme(theme.value, accent.value));
  const committedOuterPaint = computed(() => outerRegionGkH3PaintForTheme(theme.value, accent.value));
  const tentativeInnerPaint = computed(() => tentativeInnerGkH3PaintForTheme(theme.value));
  const tentativeOuterPaint = computed(() => tentativeOuterGkH3PaintForTheme(theme.value));

  const committedInnerGkH3El = shallowRef<HTMLElement | null>(null);
  const committedOuterGkH3El = shallowRef<HTMLElement | null>(null);
  const tentativeInnerGkH3El = shallowRef<HTMLElement | null>(null);
  const tentativeOuterGkH3El = shallowRef<HTMLElement | null>(null);

  watch(
    options.gkMapEl,
    (host, _prev, onCleanup) => {
      onCleanup(
        bindMapViewScopeSaveHover(host, (active) => {
          savePreviewHover.value = active;
        }),
      );
    },
    { immediate: true },
  );

  watch(options.viewDirty, (dirty) => {
    if (!dirty) savePreviewHover.value = false;
  });

  watch(
    [committedInnerGkH3El, committedCorePaint, innerH3Cell],
    () => {
      if (!innerH3Cell.value) return;
      syncGkH3PaintAttributes(committedInnerGkH3El.value, committedCorePaint.value);
    },
    { immediate: true },
  );

  watch(
    [committedOuterGkH3El, committedOuterPaint, outerH3Cell],
    () => {
      if (!outerH3Cell.value) return;
      syncGkH3PaintAttributes(committedOuterGkH3El.value, committedOuterPaint.value);
    },
    { immediate: true },
  );

  watch(
    [tentativeInnerGkH3El, tentativeInnerPaint, tentativeInnerH3Cell],
    () => {
      if (!tentativeInnerH3Cell.value) return;
      syncGkH3PaintAttributes(tentativeInnerGkH3El.value, tentativeInnerPaint.value);
    },
    { immediate: true },
  );

  watch(
    [tentativeOuterGkH3El, tentativeOuterPaint, tentativeOuterH3Cell],
    () => {
      if (!tentativeOuterH3Cell.value) return;
      syncGkH3PaintAttributes(tentativeOuterGkH3El.value, tentativeOuterPaint.value);
    },
    { immediate: true },
  );

  function clearSavePreviewHover(): void {
    savePreviewHover.value = false;
  }

  return {
    savePreviewHover,
    committedScopeViewport,
    innerH3Cell,
    outerH3Cell,
    tentativeInnerH3Cell,
    tentativeOuterH3Cell,
    showCommittedScopeOverlays,
    showTentativeScopePreview,
    showViewActions,
    viewActionsJson,
    committedInnerGkH3El,
    committedOuterGkH3El,
    tentativeInnerGkH3El,
    tentativeOuterGkH3El,
    clearSavePreviewHover,
  };
}