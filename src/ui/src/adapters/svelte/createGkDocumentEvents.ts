import { bindDocumentEvents, type DocumentEventBinding } from '../shared/document-events';

/** Register document/window listeners; call stop() from onDestroy. */
export function createGkDocumentEvents(
  bindings: DocumentEventBinding[] | (() => DocumentEventBinding[])
) {
  let unbind: (() => void) | null = null;

  return {
    start() {
      unbind?.();
      const resolved = typeof bindings === 'function' ? bindings() : bindings;
      unbind = bindDocumentEvents(resolved);
    },
    stop() {
      unbind?.();
      unbind = null;
    },
    destroy() {
      this.stop();
    },
  };
}
