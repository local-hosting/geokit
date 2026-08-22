import { onUnmounted } from 'vue';
import { bindDocumentEvents, type DocumentEventBinding } from '../shared/document-events.js';

/** Register document/window listeners with automatic cleanup. */
export function useGkDocumentEvents(
  bindings: DocumentEventBinding[] | (() => DocumentEventBinding[])
): void {
  let unbind: (() => void) | null = null;

  const attach = (): void => {
    unbind?.();
    const resolved = typeof bindings === 'function' ? bindings() : bindings;
    unbind = bindDocumentEvents(resolved);
  };

  attach();
  onUnmounted(() => {
    unbind?.();
    unbind = null;
  });
}
