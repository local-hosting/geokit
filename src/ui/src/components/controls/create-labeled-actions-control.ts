export type LabeledAction = {
  id: string;
  label: string;
  /** Built-in slug — renders icon chrome like terrain (`gk-ctrl-action-icon--{slug}`). */
  icon?: string;
};

export type LabeledActionsControlOptions = {
  getActions: () => LabeledAction[];
  onAction?: (id: string) => void;
  /** Accessible name for the control group. */
  groupLabel?: string;
};

export type LabeledActionsControl = {
  onAdd: (_map: unknown) => HTMLElement;
  onRemove: () => void;
  rebuild: () => void;
};

function isLabeledAction(value: unknown): value is LabeledAction {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.label !== 'string') return false;
  if (row.icon !== undefined && typeof row.icon !== 'string') return false;
  return true;
}

const ICON_SLUG_PATTERN = /^[a-z0-9-]+$/;

function iconClassSlug(icon: string): string | null {
  const slug = icon.trim().toLowerCase();
  if (!slug || !ICON_SLUG_PATTERN.test(slug)) return null;
  return slug;
}

/** Parse JSON `actions` attribute value for `gk-control-actions`. */
export function parseLabeledActionsAttribute(value: string | null): LabeledAction[] {
  if (!value?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLabeledAction);
  } catch {
    return [];
  }
}

/**
 * Fallback IControl (Mapbox / MapLibre) — labeled buttons in a ctrl-group.
 */
export function createLabeledActionsControl(
  options: LabeledActionsControlOptions,
): LabeledActionsControl {
  const groupLabel = options.groupLabel ?? 'Map actions';
  let container: HTMLDivElement | null = null;
  const clickHandlers = new Map<HTMLButtonElement, () => void>();

  function clearButtons(): void {
    if (!container) return;
    for (const [button, handler] of clickHandlers) {
      button.removeEventListener('click', handler);
    }
    clickHandlers.clear();
    container.replaceChildren();
  }

  function renderButtons(): void {
    if (!container) return;
    clearButtons();
    const actions = options.getActions();
    for (const action of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', action.label);
      button.setAttribute('data-action-id', action.id);
      const iconSlug = action.icon ? iconClassSlug(action.icon) : null;
      if (iconSlug) {
        button.className = `gk-ctrl-action-icon gk-ctrl-action-icon--${iconSlug}`;
        button.title = action.label;
        const icon = document.createElement('span');
        icon.className = 'maplibregl-ctrl-icon';
        icon.setAttribute('aria-hidden', 'true');
        button.appendChild(icon);
      } else {
        button.className = 'gk-ctrl-action maplibregl-ctrl-text';
        button.textContent = action.label;
      }
      const onClick = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        options.onAction?.(action.id);
      };
      button.addEventListener('click', onClick);
      clickHandlers.set(button, onClick);
      container.appendChild(button);
    }
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', groupLabel);
  }

  return {
    onAdd() {
      container = document.createElement('div');
      container.className =
        'maplibregl-ctrl maplibregl-ctrl-group mapboxgl-ctrl mapboxgl-ctrl-group';
      renderButtons();
      return container;
    },
    onRemove() {
      clearButtons();
      container?.remove();
      container = null;
    },
    rebuild() {
      renderButtons();
    },
  };
}
