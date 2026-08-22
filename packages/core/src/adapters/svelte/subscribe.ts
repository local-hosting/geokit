export type Subscriber<T> = (value: T) => void;

export type Readable<T> = {
  subscribe: (subscriber: Subscriber<T>) => () => void;
  get: () => T;
};

export function createReadable<T>(getValue: () => T): Readable<T> {
  const subscribers = new Set<Subscriber<T>>();

  return {
    get: getValue,
    subscribe(subscriber) {
      subscriber(getValue());
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
  };
}

export function notifySubscribers<T>(subscribers: Set<Subscriber<T>>, value: T): void {
  for (const subscriber of subscribers) subscriber(value);
}

export type Store<T> = {
  get: () => T;
  set: (value: T) => void;
  subscribe: (subscriber: Subscriber<T>) => () => void;
  clearSubscribers: () => void;
};

/** Mutable store with Svelte-compatible subscribe(). */
export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const subscribers = new Set<Subscriber<T>>();

  return {
    get: () => state,
    set(value: T) {
      state = value;
      notifySubscribers(subscribers, state);
    },
    subscribe(subscriber: Subscriber<T>) {
      subscriber(state);
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    clearSubscribers() {
      subscribers.clear();
    },
  };
}
