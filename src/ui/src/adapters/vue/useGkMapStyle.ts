import { watch, type ComputedRef, type Ref } from 'vue';
import type { GkMapElement } from '../shared/types';

/** Keep gk-map map-style attribute in sync with a reactive style id/url. */
export function useGkMapStyle(
  mapElement: Ref<GkMapElement | null>,
  mapStyle: Ref<string> | ComputedRef<string>
): void {
  watch(
    mapStyle,
    style => {
      mapElement.value?.setAttribute?.('map-style', style);
    },
    { immediate: true }
  );
}
