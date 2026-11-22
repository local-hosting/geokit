const MAP_VIEW_SCOPE_SAVE_ACTION_SELECTOR = '[data-action-id="save"]';

/** Track hover on the map Save view-scope control (for tentative H3 preview). */
export function bindMapViewScopeSaveHover(
  host: HTMLElement | null | undefined,
  onHover: (active: boolean) => void,
): () => void {
  if (!host) return () => {};

  const handleOver = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest(MAP_VIEW_SCOPE_SAVE_ACTION_SELECTOR)) return;
    onHover(true);
  };

  const handleOut = (event: Event) => {
    const mouseEvent = event as MouseEvent;
    const from =
      event.target instanceof Element ? event.target.closest(MAP_VIEW_SCOPE_SAVE_ACTION_SELECTOR) : null;
    if (!from) return;
    const related = mouseEvent.relatedTarget;
    if (related instanceof Element && related.closest(MAP_VIEW_SCOPE_SAVE_ACTION_SELECTOR)) return;
    onHover(false);
  };

  host.addEventListener('mouseover', handleOver);
  host.addEventListener('mouseout', handleOut);

  return () => {
    host.removeEventListener('mouseover', handleOver);
    host.removeEventListener('mouseout', handleOut);
  };
}