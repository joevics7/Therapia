"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useStored } from "@/lib/store";

type Ctx = { armed: boolean; setArmed: (b: boolean) => void; exit: () => void };
const C = createContext<Ctx>({ armed: false, setArmed: () => {}, exit: () => {} });
export const useQuickExit = () => useContext(C);

// Swaps the whole screen for a plain shopping list. Double-tap "Notes" (or press Escape twice) to come back.
// It does not clear browser history, and the app says so in the Tools page.
export function QuickExitProvider({ children }: { children: React.ReactNode }) {
  const [armed, setArmed] = useStored("qxArmed", false);
  const [covered, setCovered] = useState(false);
  const last = useRef(0);
  const lastEsc = useRef(0);

  const exit = useCallback(() => setCovered(true), []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !armed) return;
      const now = Date.now();
      if (now - lastEsc.current < 500) { lastEsc.current = 0; setCovered(true); } else lastEsc.current = now;
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [armed]);

  const tap = () => {
    const now = Date.now();
    if (now - last.current < 450) { last.current = 0; setCovered(false); } else last.current = now;
  };

  return (
    <C.Provider value={{ armed, setArmed, exit }}>
      {children}
      {armed && !covered && (
        <div className="qxbar"><span>Quick exit is on</span><button className="btn sm primary" onClick={exit}>Exit now</button></div>
      )}
      {covered && (
        <div className="cover">
          <h1 className="cv-title" onClick={tap}>Notes</h1>
          <p className="cv-sub">Shopping list</p>
          <ul className="cv-list"><li>Rice, 5 kg</li><li>Tomatoes and pepper</li><li>Onions</li><li>Palm oil</li><li>Garri</li><li>Bread</li></ul>
        </div>
      )}
    </C.Provider>
  );
}
