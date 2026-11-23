const MAP_VIEW_SCOPE_SAVE_ACTION_SELECTOR =
  '[data-action-id="save"], button.gk-ctrl-action-icon--save';

type MapScopeSaveHoverHost = HTMLElement & {
  getMap?: () => { getContainer?: () => HTMLElement } | null | undefined;
};

function resolveMapViewScopeSaveHoverRoot(host: HTMLElement): HTMLElement {
  const map = (host as MapScopeSaveHoverHost).getMap?.();
  const container = map?.getContainer?.();
  return container ?? host;
}

function saveControlInMapRoot(target: EventTarget | null, root: HTMLElement): Element | null {
  if (!(target instanceof Element)) return null;
  const control = target.closest(MAP_VIEW_SCOPE_SAVE_ACTION_SELECTOR);
  if (!control) return null;
  return root.contains(control) ? control : null;
}

/** Track hover on the map Save view-scope control (for tentative H3 preview). */
export function bindMapViewScopeSaveHover(
  host: HTMLElement | null | undefined,
  onHover: (active: boolean) => void,
): () => void {
  if (!host) return () => {};

  let saveHovered = false;

  const setHover = (active: boolean): void => {
    if (saveHovered === active) return;
    saveHovered = active;
    onHover(active);
  };

  const clearHover = (): void => {
    setHover(false);
  };

  const handleOver = (event: Event) => {
    const root = resolveMapViewScopeSaveHoverRoot(host);
    if (!saveControlInMapRoot(event.target, root)) return;
    setHover(true);
  };

  const handleOut = (event: Event) => {
    const root = resolveMapViewScopeSaveHoverRoot(host);
    const from = saveControlInMapRoot(event.target, root);
    if (!from) return;
    const mouseEvent = event as MouseEvent;
    const related = mouseEvent.relatedTarget;
    if (related instanceof Element && saveControlInMapRoot(related, root)) return;
    clearHover();
  };

  const handleDocumentMouseOut = (event: Event): void => {
    const related = (event as MouseEvent).relatedTarget;
    if (related !== null) return;
    if (!saveHovered) return;
    clearHover();
  };

  const handleWindowBlur = (): void => {
    clearHover();
  };

  host.addEventListener('mouseover', handleOver);
  host.addEventListener('mouseout', handleOut);
  document.addEventListener('mouseover', handleOver, true);
  document.addEventListener('mouseout', handleOut, true);
  document.addEventListener('mouseout', handleDocumentMouseOut);
  window.addEventListener('blur', handleWindowBlur);
  return () => {
    host.removeEventListener('mouseover', handleOver);
    host.removeEventListener('mouseout', handleOut);
    document.removeEventListener('mouseover', handleOver, true);
    document.removeEventListener('mouseout', handleOut, true);
    document.removeEventListener('mouseout', handleDocumentMouseOut);
    window.removeEventListener('blur', handleWindowBlur);
  };
}