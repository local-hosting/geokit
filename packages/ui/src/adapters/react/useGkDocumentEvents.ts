import { useEffect, useRef } from 'react';
import { bindDocumentEvents, type DocumentEventBinding } from '../shared/document-events';

/** Register document/window listeners with automatic cleanup. */
export function useGkDocumentEvents(
  bindings: DocumentEventBinding[] | (() => DocumentEventBinding[])
): void {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    const resolved =
      typeof bindingsRef.current === 'function' ? bindingsRef.current() : bindingsRef.current;
    return bindDocumentEvents(resolved);
  }, []);
}
