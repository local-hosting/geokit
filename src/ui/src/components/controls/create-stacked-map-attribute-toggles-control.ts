import { parseBooleanAttribute } from '../boolean-attr';
import type { MapAttributeToggleControl } from './create-map-attribute-toggle-control';

export type StackedMapAttributeToggleSpec = {
  /** Stable id for host `change` events. */
  id: string;
  label: string;
  attributes: readonly [string, ...string[]];
  offClass: string;
  onClass: string;
};

type MountedToggle = StackedMapAttributeToggleSpec & {
  button: HTMLButtonElement;
  syncFromMap: () => void;
  onClick: (event: Event) => void;
};

export function createStackedMapAttributeTogglesControl(options: {
  getMapElement: () => HTMLElement | null;
  toggles: readonly StackedMapAttributeToggleSpec[];
  onChange?: (id: string, enabled: boolean) => void;
}): MapAttributeToggleControl {
  let container: HTMLDivElement | null = null;
  let mounted: MountedToggle[] = [];
  let observer: MutationObserver | null = null;

  function allAttributes(): string[] {
    return [...new Set(options.toggles.flatMap((t) => [...t.attributes]))];
  }

  function syncAllFromMap(): void {
    for (const toggle of mounted) toggle.syncFromMap();
  }

  return {
    onAdd() {
      container = document.createElement('div');
      container.className = 'maplibregl-ctrl maplibregl-ctrl-group mapboxgl-ctrl mapboxgl-ctrl-group';

      for (const spec of options.toggles) {
        const readEnabled = (mapEl: HTMLElement | null): boolean => {
          if (!mapEl) return false;
          return parseBooleanAttribute(mapEl.getAttribute(spec.attributes[0]), false);
        };

        const button = document.createElement('button');
        button.type = 'button';
        button.className = spec.offClass;
        button.setAttribute('aria-label', spec.label);
        const icon = document.createElement('span');
        icon.className = 'maplibregl-ctrl-icon mapboxgl-ctrl-icon';
        icon.setAttribute('aria-hidden', 'true');
        button.appendChild(icon);

        const syncFromMap = (): void => {
          const enabled = readEnabled(options.getMapElement());
          button.classList.toggle(spec.offClass, !enabled);
          button.classList.toggle(spec.onClass, enabled);
          button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
          button.title = enabled ? `${spec.label} (on)` : `${spec.label} (off)`;
        };

        const onClick = (event: Event): void => {
          event.preventDefault();
          event.stopPropagation();
          const mapEl = options.getMapElement();
          if (!mapEl) return;
          const next = !readEnabled(mapEl);
          for (const name of spec.attributes) mapEl.setAttribute(name, next ? 'true' : 'false');
          syncFromMap();
          options.onChange?.(spec.id, next);
        };

        button.addEventListener('click', onClick);
        container.appendChild(button);
        mounted.push({ ...spec, button, syncFromMap, onClick });
      }

      const mapEl = options.getMapElement();
      if (mapEl && typeof MutationObserver !== 'undefined') {
        observer = new MutationObserver(() => syncAllFromMap());
        observer.observe(mapEl, { attributes: true, attributeFilter: allAttributes() });
      }

      syncAllFromMap();
      return container;
    },
    onRemove() {
      for (const toggle of mounted) {
        toggle.button.removeEventListener('click', toggle.onClick);
      }
      observer?.disconnect();
      observer = null;
      mounted = [];
      container?.remove();
      container = null;
    },
    syncFromMap: syncAllFromMap,
  };
}