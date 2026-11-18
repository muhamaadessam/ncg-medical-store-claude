import { useSyncExternalStore } from 'react';
import {
  addLine,
  removeLines,
  sanitizeLines,
  setLineBundles,
  type AddResult,
  type CartLine,
} from './cartLogic';

export const CART_STORAGE_KEY = 'ncg.cart.v1';

type Listener = () => void;

/** Minimal storage interface so tests can pass a fake (or none). */
export interface CartStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function safeStorage(): CartStorage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined; // e.g. storage disabled by the browser
  }
}

export function createCartStore(storage: CartStorage | undefined = safeStorage()) {
  const listeners = new Set<Listener>();

  const read = (): CartLine[] => {
    try {
      const raw = storage?.getItem(CART_STORAGE_KEY);
      return raw ? sanitizeLines(JSON.parse(raw)) : [];
    } catch {
      return []; // corrupt JSON: start with an empty cart rather than crash
    }
  };

  let lines: readonly CartLine[] = read();

  const commit = (next: CartLine[]) => {
    lines = next;
    try {
      storage?.setItem(CART_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Quota or privacy mode: the cart still works for this page view.
    }
    listeners.forEach((l) => l());
  };

  return {
    getLines: () => lines,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    add(item: { tierId: string; productId: string }, bundles = 1): AddResult {
      const result = addLine(lines, item, bundles);
      commit(result.lines);
      return result;
    },
    setBundles(tierId: string, bundles: unknown) {
      commit(setLineBundles(lines, tierId, bundles));
    },
    remove(...tierIds: string[]) {
      commit(removeLines(lines, tierIds));
    },
    clear() {
      commit([]);
    },
    /** Put back a previous snapshot (used by "Undo"). */
    restore(snapshot: readonly CartLine[]) {
      commit(sanitizeLines(snapshot));
    },
    /** Re-read storage (another tab changed the cart). */
    reload() {
      lines = read();
      listeners.forEach((l) => l());
    },
  };
}

export type CartStore = ReturnType<typeof createCartStore>;

/** The app-wide cart. */
export const cartStore = createCartStore();

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === CART_STORAGE_KEY) cartStore.reload();
  });
}

export function useCartLines(): readonly CartLine[] {
  return useSyncExternalStore(cartStore.subscribe, cartStore.getLines, cartStore.getLines);
}
