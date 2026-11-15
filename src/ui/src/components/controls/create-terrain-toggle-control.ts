import { parseBooleanAttribute } from '../boolean-attr';

export type TerrainToggleControlOptions = {
  /** Parent `gk-map` (or host that owns `terrain-enabled`). */
  getMapElement: () => HTMLElement | null;
  /** Fired after the map attributes are updated. */
  onChange?: (enabled: boolean) => void;
  /** Accessible name for the button. */
  label?: string;
};

export type TerrainToggleControl = {
  onAdd: (_map: unknown) => HTMLElement;
  onRemove: () => void;
  /** Sync pressed state from the map element (e.g. after host sets attrs). */
  syncFromMap: () => void;
};

function readTerrainEnabled(mapEl: HTMLElement | null): boolean {
  if (!mapEl) return false;
  return parseBooleanAttribute(mapEl.getAttribute('terrain-enabled'), false);
}

function writeTerrainEnabled(mapEl: HTMLElement, enabled: boolean): void {
  const value = enabled ? 'true' : 'false';
  mapEl.setAttribute('terrain-enabled', value);
  mapEl.setAttribute('hillshade-enabled', value);
}

/**
 * Fallback IControl (Mapbox / MapLibre) matching MapTiler terrain button DOM:
 * `maplibregl-ctrl-group` + `maplibregl-ctrl-terrain` + `maplibregl-ctrl-icon`.
 */
export function createTerrainToggleControl(
  options: TerrainToggleControlOptions
): TerrainToggleControl {
  const label = options.label ?? '3D terrain';
  let container: HTMLDivElement | null = null;
  let button: HTMLButtonElement | null = null;
  let observer: MutationObserver | null = null;

  function syncFromMap(): void {
    if (!button) return;
    const enabled = readTerrainEnabled(options.getMapElement());
    button.classList.toggle('maplibregl-ctrl-terrain', !enabled);
    button.classList.toggle('maplibregl-ctrl-terrain-enabled', enabled);
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    button.title = enabled ? `${label} (on)` : `${label} (off)`;
  }

  function onClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const mapEl = options.getMapElement();
    if (!mapEl) return;
    const next = !readTerrainEnabled(mapEl);
    writeTerrainEnabled(mapEl, next);
    syncFromMap();
    options.onChange?.(next);
  }

  return {
    onAdd() {
      // Same dual-class shell as MapTiler NavigationControl / MaptilerTerrainControl.
      container = document.createElement('div');
      container.className = 'maplibregl-ctrl maplibregl-ctrl-group mapboxgl-ctrl mapboxgl-ctrl-group';

      button = document.createElement('button');
      button.type = 'button';
      button.className = 'maplibregl-ctrl-terrain';
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
        observer.observe(mapEl, {
          attributes: true,
          attributeFilter: ['terrain-enabled', 'hillshade-enabled'],
        });
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
