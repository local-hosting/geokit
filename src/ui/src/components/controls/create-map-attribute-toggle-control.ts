import { parseBooleanAttribute } from '../boolean-attr';

export type MapAttributeToggleControlOptions = {
  /** Parent `gk-map` (or host that owns the toggled attributes). */
  getMapElement: () => HTMLElement | null;
  /** Fired after the map attributes are updated. */
  onChange?: (enabled: boolean) => void;
  /** Accessible name for the button. */
  label: string;
  /** Boolean attributes written together; the first is the source of truth. */
  attributes: readonly [string, ...string[]];
  /** Button class while off. */
  offClass: string;
  /** Button class while on. */
  onClass: string;
};

export type MapAttributeToggleControl = {
  onAdd: (_map: unknown) => HTMLElement;
  onRemove: () => void;
  /** Sync pressed state from the map element (e.g. after host sets attrs). */
  syncFromMap: () => void;
};

/**
 * IControl (Mapbox / MapLibre) icon button that flips boolean attributes on the
 * parent map: `maplibregl-ctrl-group` > `button` > `maplibregl-ctrl-icon`.
 */
export function createMapAttributeToggleControl(
  options: MapAttributeToggleControlOptions
): MapAttributeToggleControl {
  const { label, attributes, offClass, onClass } = options;
  let container: HTMLDivElement | null = null;
  let button: HTMLButtonElement | null = null;
  let observer: MutationObserver | null = null;

  function readEnabled(mapEl: HTMLElement | null): boolean {
    if (!mapEl) return false;
    return parseBooleanAttribute(mapEl.getAttribute(attributes[0]), false);
  }

  function syncFromMap(): void {
    if (!button) return;
    const enabled = readEnabled(options.getMapElement());
    button.classList.toggle(offClass, !enabled);
    button.classList.toggle(onClass, enabled);
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    button.title = enabled ? `${label} (on)` : `${label} (off)`;
  }

  function onClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const mapEl = options.getMapElement();
    if (!mapEl) return;
    const next = !readEnabled(mapEl);
    for (const name of attributes) mapEl.setAttribute(name, next ? 'true' : 'false');
    syncFromMap();
    options.onChange?.(next);
  }

  return {
    onAdd() {
      container = document.createElement('div');
      container.className = 'maplibregl-ctrl maplibregl-ctrl-group mapboxgl-ctrl mapboxgl-ctrl-group';

      button = document.createElement('button');
      button.type = 'button';
      button.className = offClass;
      button.setAttribute('aria-label', label);
      const icon = document.createElement('span');
      icon.className = 'maplibregl-ctrl-icon';
      icon.setAttribute('aria-hidden', 'true');
      button.appendChild(icon);
      button.addEventListener('click', onClick);
      container.appendChild(button);

      const mapEl = options.getMapElement();
      if (mapEl && typeof MutationObserver !== 'undefined') {
        observer = new MutationObserver(() => syncFromMap());
        observer.observe(mapEl, { attributes: true, attributeFilter: [...attributes] });
      }

      syncFromMap();
      return container;
    },
    onRemove() {
      button?.removeEventListener('click', onClick);
      observer?.disconnect();
      observer = null;
      container?.remove();
      container = null;
      button = null;
    },
    syncFromMap,
  };
}
