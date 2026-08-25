export type DocumentEventBinding = {
  type: string;
  listener: EventListener;
  target?: EventTarget;
};

export function bindDocumentEvents(bindings: DocumentEventBinding[]): () => void {
  for (const { type, listener, target = document } of bindings) {
    target.addEventListener(type, listener);
  }
  return () => {
    for (const { type, listener, target = document } of bindings) {
      target.removeEventListener(type, listener);
    }
  };
}
