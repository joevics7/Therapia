"use client";
import { useCallback, useEffect, useState } from "react";

// Device-local storage for the pre-account stage. Moves to Supabase (anonymous accounts) later.
// Wrapped in try/catch: private windows and cleared site data can make storage unavailable.
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("therapia." + key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch { /* keep initial */ }
    setReady(true);
  }, [key]);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try { localStorage.setItem("therapia." + key, JSON.stringify(v)); } catch { /* ignore */ }
      return v;
    });
  }, [key]);

  return [value, set, ready] as const;
}

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
