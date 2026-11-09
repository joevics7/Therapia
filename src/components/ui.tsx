"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { EMERGENCY, HELP_CHECKED, HELP_GROUPS } from "@/lib/help";
import { useQuickExit } from "./QuickExit";

export function useToast() {
  const [msg, setMsg] = useState("");
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const say = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(""), 3200);
  }, []);
  const toast = msg ? <div className="toast" role="status" aria-live="polite">{msg}</div> : null;
  return { say, toast };
}

export function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="sheet-root">
      <div className="sheet-bd" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}

export function HelpSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <h3 className="display">You are not alone</h3>
      <p>If you or someone near you is in danger right now, call emergency services or go to someone you trust nearby.</p>
      <a className="btn primary big" href={`tel:${EMERGENCY.number}`}>Call {EMERGENCY.number} · {EMERGENCY.name}</a>
      {HELP_GROUPS.map((g) => (
        <div className="helpgrp" key={g.title}>
          <div className="eyebrow">{g.title}</div>
          {g.lines.map((l) => (
            <a className="helpline" key={l.number} href={`tel:${l.number}`}>
              <span><b>{l.name}</b><span className="fine">{l.note}</span></span>
              <span className="num">{l.number}</span>
            </a>
          ))}
        </div>
      ))}
      <p className="fine">Numbers last checked {HELP_CHECKED}. If one doesn&rsquo;t answer, try another. Calling is the quickest way to reach a person.</p>
      <button className="btn ghost big" onClick={onClose}>Close</button>
    </Sheet>
  );
}

export function PageHead({ title, sub }: { title: string; sub?: string }) {
  const [help, setHelp] = useState(false);
  return (
    <>
      <header className="phead">
        <div><h1 className="display ptitle">{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
        <button className="pill-help" onClick={() => setHelp(true)}>♥ Need help now</button>
      </header>
      {help && <HelpSheet onClose={() => setHelp(false)} />}
    </>
  );
}

export function Chips({ list, cur, onPick }: { list: string[]; cur: string; onPick: (v: string) => void }) {
  return (
    <div className="chips" role="group">
      {list.map((c) => <button key={c} className="chip" aria-pressed={cur === c} onClick={() => onPick(c)}>{c}</button>)}
    </div>
  );
}

export function QuickExitButton({ className = "btn ghost", label = "Quick exit" }: { className?: string; label?: string }) {
  const { exit } = useQuickExit();
  return <button className={className} onClick={exit}>{label}</button>;
}
