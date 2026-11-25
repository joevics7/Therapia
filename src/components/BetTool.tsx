"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStored } from "@/lib/store";
import Arcade from "@/components/Arcade";
import { type Wallet, dayKey, newWallet, topUp } from "@/lib/arcade";

type Plan = { mode: "reduce" | "quit"; start: string; baseline: number; step: number };
type Bet = { at: string; amount: number };
type UrgeNote = { at: string; after: "much" | "bit" | "same" | "more"; rounds: number };
const DAY = 86_400_000;
const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;
const round100 = (n: number) => Math.max(0, Math.round(n / 100) * 100);

/** Step-down betting plan. Everything stays on this device. */
export default function BetTool() {
  const [plan, setPlan, ready] = useStored<Plan | null>("bet.plan", null);
  const [log, setLog] = useStored<Bet[]>("bet.log", []);
  const [urges, setUrges] = useStored<string[]>("bet.urges", []);
  const [base, setBase] = useState(""), [step, setStep] = useState(20), [amt, setAmt] = useState("");
  const [wallet, setWallet] = useStored<Wallet | null>("bet.wallet", null);
  const [urgeLog, setUrgeLog] = useStored<UrgeNote[]>("bet.urgelog", []);
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState("");

  // Everyone starts with 100 coins; +10 a day; +30 for each finished day without a logged bet.
  useEffect(() => {
    if (!ready) return;
    const betDays = new Set(log.map((b) => dayKey(new Date(b.at))));
    setWallet((w) => { const cur = w ?? newWallet(); const next = topUp(cur, plan, betDays); return next === cur && w ? w : next; });
  }, [ready, plan, log, setWallet]);

  if (!ready) return null;

  const arcade = (
    <Arcade
      wallet={wallet ?? newWallet()}
      setWallet={(f) => setWallet((w) => f(w ?? newWallet()))}
      onDone={(after, rounds) => {
        if (after) { setUrgeLog((l) => [{ at: new Date().toISOString(), after, rounds }, ...l].slice(0, 200)); setUrges((u) => [new Date().toISOString(), ...u]); }
        setPlaying(false);
        setNote(after === "much" || after === "bit" ? "Well done. The urge passed without a bet." : "Thanks for telling us. If it's still strong, open a group and talk to someone.");
      }}
    />
  );

  if (playing) return arcade;

  if (!plan) {
    return (
      <>
        <h1 className="display ptitle">Betting plan</h1>
        <p className="muted">Cut down gradually, one week at a time, or stop completely. This stays on your phone. Nobody else can see it, and nothing is sent to Theraping.</p>
        <form className="card stack" onSubmit={(e) => {
          e.preventDefault();
          const b = Number(base.replace(/[, ]/g, ""));
          if (!Number.isFinite(b) || b < 0) { setNote("Enter a number, like 5000."); return; }
          setPlan({ mode: "reduce", start: new Date().toISOString(), baseline: b, step }); setNote("");
        }}>
          <label className="stack"><span className="eyebrow">About how much do you bet in a normal week? (₦)</span>
            <input className="field" inputMode="numeric" required value={base} onChange={(e) => setBase(e.target.value)} placeholder="5000" /></label>
          <label className="stack"><span className="eyebrow">Lower your weekly limit by</span>
            <select className="field" value={step} onChange={(e) => setStep(Number(e.target.value))}><option value={10}>10% each week (slow)</option><option value={20}>20% each week</option><option value={30}>30% each week (fast)</option></select></label>
          {note && <p className="err" role="alert">{note}</p>}
          <button className="btn primary" type="submit">Start my plan</button>
        </form>
        <button className="btn soft" type="button" onClick={() => { setNote(""); setPlaying(true); }}>Feeling an urge now? Play instead</button>
        <p className="fine">Be honest with yourself here; the plan only works with real numbers. If you want to stop completely, you can switch after you start.</p>
      </>
    );
  }

  const now = Date.now(), start = new Date(plan.start).getTime();
  const weekIdx = Math.max(0, Math.floor((now - start) / (7 * DAY)));
  const weekStart = start + weekIdx * 7 * DAY;
  const cap = plan.mode === "quit" ? 0 : round100(plan.baseline * Math.pow(1 - plan.step / 100, weekIdx));
  const spent = log.filter((b) => new Date(b.at).getTime() >= weekStart).reduce((s, b) => s + b.amount, 0);
  const left = cap - spent;
  const lastBet = log.length ? Math.max(...log.map((b) => new Date(b.at).getTime())) : start;
  const clean = Math.floor((now - Math.max(lastBet, start)) / DAY);
  const total = log.reduce((s, b) => s + b.amount, 0);
  const saved = Math.max(0, (plan.baseline * (now - start)) / (7 * DAY) - total);
  const pct = cap > 0 ? Math.min(100, (spent / cap) * 100) : spent > 0 ? 100 : 0;
  const over = spent > cap;

  function add(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amt.replace(/[, ]/g, ""));
    if (!Number.isFinite(n) || n <= 0) { setNote("Enter the amount you bet."); return; }
    setLog((l) => [{ at: new Date().toISOString(), amount: n }, ...l]); setAmt("");
    setNote(spent + n > cap ? "Logged. That's over this week's limit. It happens; one slip doesn't undo your progress. Next week starts fresh." : "Logged. Thank you for being honest.");
  }

  return (
    <>
      <h1 className="display ptitle">Betting plan</h1>
      <p className="muted">{plan.mode === "quit" ? "Your goal: no betting at all." : `Week ${weekIdx + 1} of your plan. Your limit comes down ${plan.step}% each week.`}</p>
      <div className="card stack">
        <span className="eyebrow">This week</span>
        <b className="display" style={{ fontSize: 28 }}>{plan.mode === "quit" ? (spent ? `${naira(spent)} bet` : "No bets") : `${naira(Math.max(0, left))} left of ${naira(cap)}`}</b>
        <div aria-hidden="true" style={{ height: 10, borderRadius: 99, background: "var(--surface2)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: over ? "var(--hib)" : "var(--green)" }} />
        </div>
        {over && <p className="fine">You&rsquo;re over this week&rsquo;s limit. Stop for the rest of the week if you can. A new week gives a fresh start.</p>}
        <span className="row" style={{ gap: 18, flexWrap: "wrap" }}>
          <span><b>{clean}</b> <span className="fine">days without a bet</span></span>
          <span><b>{urges.length}</b> <span className="fine">urges ridden out</span></span>
          <span><b>~{naira(saved)}</b> <span className="fine">estimated kept</span></span>
          <span><b>🪙 {(wallet ?? newWallet()).coins}</b> <span className="fine">play coins</span></span>
          {urgeLog.length > 0 && <span><b>{urgeLog.filter((u) => u.after === "much" || u.after === "bit").length}/{urgeLog.length}</b> <span className="fine">times the urge dropped after playing</span></span>}
        </span>
      </div>

      <button className="btn accent big" onClick={() => { setNote(""); setPlaying(true); }}>I want to bet right now</button>

      <form className="card stack" onSubmit={add}>
        <label className="stack"><span className="eyebrow">I placed a bet (₦)</span><input className="field" inputMode="numeric" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="Amount" /></label>
        <button className="btn soft" type="submit">Log it</button>
      </form>
      {note && <p className="fine" role="status">{note}</p>}

      {log.length > 0 && (
        <section className="stack">
          <h2 className="sec-h display">Recent bets</h2>
          {log.slice(0, 5).map((b, i) => (
            <div className="card row adm-line" key={b.at + i} style={{ justifyContent: "space-between" }}>
              <span>{naira(b.amount)} <span className="fine">· {new Date(b.at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</span></span>
              <button className="icon-btn" aria-label="Remove this entry" onClick={() => setLog((l) => l.filter((x) => x !== b))}>🗑</button>
            </div>
          ))}
        </section>
      )}

      <div className="card stack">
        <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn ghost sm" onClick={() => setPlan({ ...plan, mode: plan.mode === "quit" ? "reduce" : "quit" })}>{plan.mode === "quit" ? "Go back to gradual" : "Switch to quitting completely"}</button>
          <button className="btn ghost sm" onClick={() => { if (window.confirm("Start over? This clears your plan and log on this device.")) { setPlan(null); setLog([]); setUrges([]); } }}>Start over</button>
        </span>
        <p className="fine">Betting hurting your life? <Link href="/groups">Join a group</Link> and talk to people who understand. Everything here stays on this device.</p>
      </div>
    </>
  );
}
