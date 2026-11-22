const MAP_VIEW_SCOPE_SAVE_ACTION_SELECTOR = '[data-action-id="save"]';

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
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest(MAP_VIEW_SCOPE_SAVE_ACTION_SELECTOR)) return;
    setHover(true);
  };

  const handleOut = (event: Event) => {
    const mouseEvent = event as MouseEvent;
    const from =
      event.target instanceof Element ? event.target.closest(MAP_VIEW_SCOPE_SAVE_ACTION_SELECTOR) : null;
    if (!from) return;
    const related = mouseEvent.relatedTarget;
    if (related instanceof Element && related.closest(MAP_VIEW_SCOPE_SAVE_ACTION_SELECTOR)) return;
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
  document.addEventListener('mouseout', handleDocumentMouseOut);
  window.addEventListener('blur', handleWindowBlur);

  return () => {
    host.removeEventListener('mouseover', handleOver);
    host.removeEventListener('mouseout', handleOut);
    document.removeEventListener('mouseout', handleDocumentMouseOut);
    window.removeEventListener('blur', handleWindowBlur);
  };
}