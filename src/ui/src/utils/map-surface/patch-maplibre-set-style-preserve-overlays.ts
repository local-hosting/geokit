import {
  styleWithPreservedOverlays,
  type StyleOverlaySpec,
} from '../../components/elements/map/style/preserve-custom-style-overlays';

type MapWithSetStyle = {
  getStyle?: () => StyleOverlaySpec | null | undefined;
  setStyle: (style: unknown, options?: unknown) => void;
  __gkPreserveOverlays?: boolean;
};

/** Wrap `map.setStyle` once so object theme swaps keep app-owned overlays mounted. */
export function patchMapLibreSetStyleToPreserveOverlays(
  map: MapWithSetStyle | null | undefined,
): void {
  if (!map?.setStyle || map.__gkPreserveOverlays) return;
  const original = map.setStyle.bind(map);
  map.setStyle = (style: unknown, options?: unknown) => {
    const previous = typeof map.getStyle === 'function' ? map.getStyle() : null;
    const merged =
      typeof style === 'string' || (style && typeof style === 'object')
        ? styleWithPreservedOverlays(previous, style as string | StyleOverlaySpec)
        : style;
    return original(merged, options);
  };
  map.__gkPreserveOverlays = true;
}