"use client";

import { useEffect, useState } from "react";

/**
 * Delay a rapidly-changing value so effects that depend on it settle.
 *
 * Used by search boxes: typing "laddu" would otherwise fire five requests, and
 * only the last one matters.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
