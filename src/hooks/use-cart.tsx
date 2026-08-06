"use client";

import * as React from "react";

/**
 * The cart.
 *
 * Lines are held in localStorage so a customer can close the tab and come
 * back. Only identifiers, quantities and a display snapshot are stored — the
 * price shown here is for display, and the server re-prices everything at
 * checkout. Editing localStorage therefore changes what you *see*, never what
 * you *pay*.
 */

const STORAGE_KEY = "vk.cart.v1";

export type CartItemKind = "MENU_ITEM" | "PRODUCT";

export interface CartLine {
  /** Stable composite key — an item with two variants is two lines. */
  key: string;
  kind: CartItemKind;
  itemId: string;
  variantId?: string;
  name: string;
  variantLabel?: string;
  image?: string | null;
  unitPrice: number;
  quantity: number;
  maxQuantity?: number;
}

export type CartAddInput = Omit<CartLine, "key" | "quantity"> & { quantity?: number };

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  isReady: boolean;
  add: (input: CartAddInput) => void;
  setQuantity: (key: string, quantity: number) => void;
  increment: (key: string) => void;
  decrement: (key: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  lineFor: (itemId: string, variantId?: string) => CartLine | undefined;
}

const CartContext = React.createContext<CartContextValue | null>(null);

function lineKey(kind: CartItemKind, itemId: string, variantId?: string): string {
  return `${kind}:${itemId}:${variantId ?? ""}`;
}

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Partial<CartLine>;
  return (
    typeof line.key === "string" &&
    typeof line.itemId === "string" &&
    typeof line.name === "string" &&
    typeof line.unitPrice === "number" &&
    typeof line.quantity === "number" &&
    line.quantity > 0 &&
    (line.kind === "MENU_ITEM" || line.kind === "PRODUCT")
  );
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = React.useState<CartLine[]>([]);
  // Guards against writing an empty cart over a stored one before hydration,
  // and lets the UI avoid rendering a "0 items" badge on the server.
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) setLines(parsed.filter(isCartLine));
      }
    } catch {
      // Corrupt or unavailable storage — start with an empty cart.
    }
    setIsReady(true);
  }, []);

  React.useEffect(() => {
    if (!isReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Private mode or quota exceeded — the cart still works for this session.
    }
  }, [lines, isReady]);

  const add = React.useCallback((input: CartAddInput) => {
    const key = lineKey(input.kind, input.itemId, input.variantId);
    const addQuantity = Math.max(1, input.quantity ?? 1);

    setLines((current) => {
      const existing = current.find((line) => line.key === key);
      if (!existing) {
        return [...current, { ...input, key, quantity: clamp(addQuantity, input.maxQuantity) }];
      }
      return current.map((line) =>
        line.key === key
          ? {
              ...line,
              // Refresh the display snapshot in case the price changed since
              // the item was first added.
              unitPrice: input.unitPrice,
              name: input.name,
              image: input.image,
              maxQuantity: input.maxQuantity,
              quantity: clamp(line.quantity + addQuantity, input.maxQuantity),
            }
          : line,
      );
    });
  }, []);

  const setQuantity = React.useCallback((key: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.key !== key)
        : current.map((line) =>
            line.key === key ? { ...line, quantity: clamp(quantity, line.maxQuantity) } : line,
          ),
    );
  }, []);

  const increment = React.useCallback((key: string) => {
    setLines((current) =>
      current.map((line) =>
        line.key === key ? { ...line, quantity: clamp(line.quantity + 1, line.maxQuantity) } : line,
      ),
    );
  }, []);

  const decrement = React.useCallback((key: string) => {
    setLines((current) =>
      current
        .map((line) => (line.key === key ? { ...line, quantity: line.quantity - 1 } : line))
        .filter((line) => line.quantity > 0),
    );
  }, []);

  const remove = React.useCallback((key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  }, []);

  const clear = React.useCallback(() => setLines([]), []);

  const lineFor = React.useCallback(
    (itemId: string, variantId?: string) =>
      lines.find((line) => line.itemId === itemId && line.variantId === variantId),
    [lines],
  );

  const value = React.useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    return {
      lines,
      count,
      subtotal: Math.round((subtotal + Number.EPSILON) * 100) / 100,
      isReady,
      add,
      setQuantity,
      increment,
      decrement,
      remove,
      clear,
      lineFor,
    };
  }, [lines, isReady, add, setQuantity, increment, decrement, remove, clear, lineFor]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = React.useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>");
  return context;
}

function clamp(quantity: number, max?: number): number {
  const upper = max && max > 0 ? Math.min(max, 99) : 99;
  return Math.max(1, Math.min(quantity, upper));
}
