"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui";
import {
  FIGHTERS, MAX_STAKE, RACERS, THROWERS, THROW_MAX, TRIP_BUCKETS, type ThrowKind, type Trip, type TripBucket, type Wallet,
  hiLoMults, hiLoNext, hiLoStart, multFor, newMatch, newTrip, raceMults, raceStep, selfThrow, throwOutcome, tripBucket, tripLimits, tripMinutes, tripMults, tugChance, tugWinner, winnings,
} from "@/lib/arcade";

type GameId = "throw" | "race" | "hilo" | "trip" | "tug";
const GAMES: { id: GameId; name: string; emoji: string; blurb: string; how: string }[] = [
  { id: "throw", name: "Ball Throw", emoji: "⚾", blurb: "Bet on how far the ball goes, or throw it yourself.", how: "Pick Over or Under the line, then watch the throw (watch out for rockets and slips): a right call doubles your coins." },
  { id: "race", name: "Danfo Race", emoji: "🚌", blurb: "Pick the winner of a street race.", how: "Pick the vehicle you think will win: a win pays the number next to it, so the longer shot pays more." },
  { id: "hilo", name: "Higher or Lower", emoji: "🔢", blurb: "Read the trend: will the next number go up or down?", how: "Study the last numbers, then guess if the next one goes Higher or Lower; big jumps can happen, and the harder call pays more." },
  { id: "trip", name: "Lagos Trip", emoji: "🚗", blurb: "How long will the trip really take?", how: "Guess if the trip will be Quick, About right or Stuck: the less likely the result, the more it pays, and accidents or shortcuts can happen." },
  { id: "tug", name: "Tug of War", emoji: "🪢", blurb: "Back the stronger puller.", how: "Back the fighter you think will win the rope: the weaker one wins less often but pays more." },
];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const NUDGE_AT = 8;

type Ctx = { coins: number; settle: (delta: number) => void };

function Stake({ coins, stake, setStake, disabled }: { coins: number; stake: number; setStake: (n: number) => void; disabled?: boolean }) {
  const max = Math.min(MAX_STAKE, coins);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="eyebrow">How many coins? (up to {MAX_STAKE})</span>
      <span className="row" style={{ gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" disabled={disabled || n > max} aria-pressed={stake === n} className={`btn sm ${stake === n ? "primary" : "soft"}`} onClick={() => setStake(n)}>{n}</button>
        ))}
      </span>
    </div>
  );
}

function Result({ msg }: { msg: string | null }) {
  return <p role="status" aria-live="polite" className="fine" style={{ minHeight: 22, margin: 0, fontWeight: 700 }}>{msg}</p>;
}

/** Shared pattern: pay or take the stake once the reveal has finished. */
function useRound({ coins, settle }: { coins: number; settle: (d: number) => void }) {
  const [stake, setStake] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (stake > Math.min(MAX_STAKE, coins) && coins > 0) setStake(Math.min(MAX_STAKE, coins)); }, [coins, stake]);
  const finish = (won: boolean | "push", mult: number) => {
    if (won === "push") setMsg("A tie, so your coins stay with you.");
    else if (won) { const w = winnings(stake, mult); settle(w); setMsg(`You won +${w} 🪙`); }
    else { settle(-stake); setMsg(`You lost ${stake} 🪙. It's just for fun.`); }
    setBusy(false);
  };
  return { stake, setStake, busy, setBusy, msg, setMsg, finish };
}

// ---------- 1. Ball Throw ----------
function BallThrow({ coins, settle }: Ctx) {
  const [mode, setMode] = useState<"bet" | "play">("bet");
  return (
    <div className="stack">
      <span className="row" style={{ gap: 6 }}>
        <button className={`btn sm ${mode === "bet" ? "primary" : "soft"}`} onClick={() => setMode("bet")}>Bet on a throw</button>
        <button className={`btn sm ${mode === "play" ? "primary" : "soft"}`} onClick={() => setMode("play")}>Throw it yourself</button>
      </span>
      {mode === "bet" ? <ThrowBet coins={coins} settle={settle} /> : <ThrowSelf />}
    </div>
  );
}
function ThrowBet({ coins, settle }: { coins: number; settle: (d: number) => void }) {
  const r = useRound({ coins, settle });
  const [i, setI] = useState(() => Math.floor(Math.random() * THROWERS.length));
  const [dist, setDist] = useState<number | null>(null);
  const [kind, setKind] = useState<ThrowKind>("normal");
  const [fly, setFly] = useState(false);
  const t = THROWERS[i], line = Math.round(t.avg);
  const flight = kind === "rocket" ? 0.6 : kind === "slip" ? 1.0 : 1.4; // seconds: rockets really are faster
  async function go(over: boolean) {
    r.setBusy(true); r.setMsg(null);
    const o = throwOutcome(t); setDist(o.dist); setKind(o.kind); setFly(false);
    await wait(50); setFly(true); await wait((o.kind === "rocket" ? 0.6 : o.kind === "slip" ? 1.0 : 1.4) * 1000 + 100);
    r.finish(o.dist === line ? "push" : (o.dist > line) === over, 2);
  }
  return (
    <div className="stack">
      <div className="card stack" style={{ gap: 6 }}>
        <b>{t.emoji} {t.name} is about to throw</b>
        <span className="muted">Usually around {t.avg} m, but anything can happen. The line is <b>{line} m</b>.</span>
        <div aria-hidden="true" style={{ position: "relative", height: 34, background: "var(--surface2)", borderRadius: 99, overflow: "hidden" }}>
          <span style={{ position: "absolute", left: `${(line / THROW_MAX) * 100}%`, top: 0, bottom: 0, width: 2, background: "var(--ink)" }} />
          <span style={{ position: "absolute", top: 4, left: fly && dist !== null ? `calc(${Math.min(96, (dist / THROW_MAX) * 100)}% - 12px)` : 4, transition: fly ? `left ${flight}s ${kind === "rocket" ? "cubic-bezier(.1,.8,.3,1)" : "ease-out"}` : "none", fontSize: 22 }}>{fly && kind === "rocket" ? "🚀" : "⚾"}</span>
        </div>
        {dist !== null && !r.busy && <b>{kind === "rocket" ? "Rocket throw! " : kind === "slip" ? "It slipped! " : ""}It landed at {dist} m.</b>}
      </div>
      <Stake coins={coins} stake={r.stake} setStake={r.setStake} disabled={r.busy} />
      <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn accent" disabled={r.busy || coins < 1} onClick={() => go(true)}>Over {line} m</button>
        <button className="btn accent" disabled={r.busy || coins < 1} onClick={() => go(false)}>Under {line} m</button>
        <button className="btn ghost sm" disabled={r.busy} onClick={() => { setI(Math.floor(Math.random() * THROWERS.length)); setDist(null); setFly(false); r.setMsg(null); }}>New thrower</button>
      </span>
      <span className="fine">Win and you double your coins.</span>
      <Result msg={r.msg} />
    </div>
  );
}
function ThrowSelf() {
  const [power, setPower] = useState(0);
  const [running, setRunning] = useState(true);
  const [dist, setDist] = useState<number | null>(null);
  const [best, setBest] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!running) return;
    const t0 = performance.now();
    const tick = (now: number) => { const x = ((now - t0) / 900) % 2; setPower(x < 1 ? x : 2 - x); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running]);
  function stop() { cancelAnimationFrame(raf.current); setRunning(false); const d = selfThrow(power); setDist(d); setBest((b) => Math.max(b, d)); }
  return (
    <div className="card stack">
      <b>Stop the bar in the middle for the longest throw.</b>
      <div aria-hidden="true" style={{ position: "relative", height: 26, background: "var(--surface2)", borderRadius: 99, overflow: "hidden" }}>
        <span style={{ position: "absolute", left: "45%", width: "10%", top: 0, bottom: 0, background: "color-mix(in srgb, var(--green) 35%, transparent)" }} />
        <span style={{ position: "absolute", left: `calc(${power * 100}% - 3px)`, width: 6, top: 0, bottom: 0, background: "var(--ink)", borderRadius: 3 }} />
      </div>
      {dist !== null && <b role="status">You threw {dist} m. {dist >= best ? "Your best so far!" : `Your best is ${best} m.`}</b>}
      {running ? <button className="btn accent" onClick={stop}>Throw!</button> : <button className="btn soft" onClick={() => { setDist(null); setRunning(true); }}>Throw again</button>}
      <span className="fine">Just for fun. No coins used or won.</span>
    </div>
  );
}

// ---------- 2. Danfo Race ----------
function Race({ coins, settle }: Ctx) {
  const r = useRound({ coins, settle });
  const mults = raceMults();
  const [pickI, setPickI] = useState(1);
  const [prog, setProg] = useState<number[]>(RACERS.map(() => 0));
  async function go() {
    r.setBusy(true); r.setMsg(null);
    let p = RACERS.map(() => 0); setProg(p);
    for (let n = 0; n < 200; n++) {
      await wait(110); p = raceStep(p); setProg(p);
      if (Math.max(...p) >= 100) break;
    }
    const w = p.indexOf(Math.max(...p));
    r.finish(w === pickI, mults[pickI]);
  }
  return (
    <div className="stack">
      <div className="card stack" style={{ gap: 8 }}>
        {RACERS.map((x, i) => (
          <div key={x.id}>
            <span className="fine">{x.emoji} {x.name} · speed {x.speed}/10</span>
            <div aria-hidden="true" style={{ height: 22, background: "var(--surface2)", borderRadius: 99, position: "relative", overflow: "hidden" }}>
              <span style={{ position: "absolute", top: 0, left: `calc(${Math.min(100, prog[i])}% - ${Math.min(100, prog[i]) * 0.22}px)`, transition: "left .1s linear", fontSize: 18 }}>{x.emoji}</span>
            </div>
          </div>
        ))}
      </div>
      <Stake coins={coins} stake={r.stake} setStake={r.setStake} disabled={r.busy} />
      <span className="eyebrow">Pick the winner</span>
      <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {RACERS.map((x, i) => <button key={x.id} disabled={r.busy} aria-pressed={pickI === i} className={`btn sm ${pickI === i ? "primary" : "soft"}`} onClick={() => setPickI(i)}>{x.emoji} {x.name} ×{mults[i]}</button>)}
      </span>
      <button className="btn accent" disabled={r.busy || coins < 1} onClick={go}>Start the race</button>
      <Result msg={r.msg} />
    </div>
  );
}

// ---------- 3. Higher or Lower ----------
function HiLo({ coins, settle }: Ctx) {
  const r = useRound({ coins, settle });
  const [hist, setHist] = useState<number[]>(() => [hiLoStart()]);
  const [next, setNext] = useState<number | null>(null);
  const n = hist[hist.length - 1];
  const m = hiLoMults(n);
  async function go(higher: boolean) {
    r.setBusy(true); r.setMsg(null);
    const x = hiLoNext(n); setNext(null);
    await wait(700); setNext(x); await wait(700);
    r.finish(x === n ? "push" : (x > n) === higher, higher ? m.higher : m.lower);
    setHist((h) => [...h, x].slice(-7)); setNext(null);
  }
  return (
    <div className="stack">
      <div className="card" style={{ textAlign: "center" }}>
        <span className="eyebrow">Current number (1 to 100)</span>
        <b className="display" style={{ display: "block", fontSize: 56 }}>{n}</b>
        {hist.length > 1 && <span className="fine">Recent: {hist.slice(0, -1).join(" → ")}</span>}
        <span className="muted" style={{ display: "block" }}>Next: {next === null ? (r.busy ? "…" : "?") : <b>{next}</b>}</span>
      </div>
      <Stake coins={coins} stake={r.stake} setStake={r.setStake} disabled={r.busy} />
      <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn accent" disabled={r.busy || coins < 1 || n === 100} onClick={() => go(true)}>Higher ×{m.higher}</button>
        <button className="btn accent" disabled={r.busy || coins < 1 || n === 1} onClick={() => go(false)}>Lower ×{m.lower}</button>
      </span>
      <Result msg={r.msg} />
    </div>
  );
}

// ---------- 4. Lagos Trip ----------
function LagosTrip({ coins, settle }: Ctx) {
  const r = useRound({ coins, settle });
  const [trip, setTrip] = useState<Trip>(() => newTrip());
  const [mins, setMins] = useState<number | null>(null);
  const mult = tripMults(trip), { lo, hi } = tripLimits(trip);
  async function go(pick: TripBucket) {
    r.setBusy(true); r.setMsg(null); setMins(null);
    const m = tripMinutes(trip); await wait(1200); setMins(m);
    r.finish(tripBucket(trip, m) === pick, mult[pick]);
    await wait(1800); setTrip(newTrip()); setMins(null);
  }
  const range: Record<TripBucket, string> = { quick: `under ${lo} min`, normal: `${lo} to ${hi} min`, stuck: `over ${hi} min` };
  return (
    <div className="stack">
      <div className="card stack" style={{ gap: 4 }}>
        <b>🚗 {trip.route.name}</b>
        <span className="muted">Conditions: {trip.cond.label}. Usual trip: {trip.route.mins} min. Anything can happen on the road.</span>
        {mins !== null && <b>The trip took {mins} min.</b>}
      </div>
      <Stake coins={coins} stake={r.stake} setStake={r.setStake} disabled={r.busy} />
      <span className="eyebrow">How long will it take?</span>
      <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {TRIP_BUCKETS.map((b) => (
          <button key={b.id} className="btn accent" disabled={r.busy || coins < 1} onClick={() => go(b.id)}>{b.label} ×{mult[b.id]}<br /><span className="fine" style={{ color: "inherit" }}>{range[b.id]}</span></button>
        ))}
      </span>
      <Result msg={r.msg} />
    </div>
  );
}

// ---------- 5. Tug of War ----------
function Tug({ coins, settle }: Ctx) {
  const r = useRound({ coins, settle });
  const [[a, b], setM] = useState<readonly [number, number]>(() => newMatch());
  const [pos, setPos] = useState(50); // 0 = A wins, 100 = B wins
  const pa = tugChance(a, b), mult = [multFor(pa), multFor(1 - pa)];
  async function go(side: 0 | 1) {
    r.setBusy(true); r.setMsg(null); setPos(50);
    const w = tugWinner(a, b);
    for (let s = 1; s <= 12; s++) { await wait(130); setPos(50 + (w === 0 ? -1 : 1) * Math.min(50, s * 5) + (s < 10 ? (s % 2 ? 4 : -4) : 0)); }
    setPos(w === 0 ? 0 : 100);
    r.finish(w === side, mult[side]);
    await wait(1600); setM(newMatch()); setPos(50);
  }
  return (
    <div className="stack">
      <div className="card stack">
        <span className="row" style={{ justifyContent: "space-between" }}>
          <span>{FIGHTERS[a].emoji} <b>{FIGHTERS[a].name}</b><br /><span className="fine">strength {FIGHTERS[a].power}/10</span></span>
          <span style={{ textAlign: "right" }}>{FIGHTERS[b].emoji} <b>{FIGHTERS[b].name}</b><br /><span className="fine">strength {FIGHTERS[b].power}/10</span></span>
        </span>
        <div aria-hidden="true" style={{ position: "relative", height: 10, borderRadius: 99, background: "var(--surface2)" }}>
          <span style={{ position: "absolute", top: -9, left: `calc(${pos}% - 14px)`, transition: "left .13s linear", fontSize: 26 }}>🪢</span>
        </div>
      </div>
      <Stake coins={coins} stake={r.stake} setStake={r.setStake} disabled={r.busy} />
      <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn accent" disabled={r.busy || coins < 1} onClick={() => go(0)}>Back {FIGHTERS[a].name} ×{mult[0]}</button>
        <button className="btn accent" disabled={r.busy || coins < 1} onClick={() => go(1)}>Back {FIGHTERS[b].name} ×{mult[1]}</button>
      </span>
      <Result msg={r.msg} />
    </div>
  );
}

/** The mini-games, shown when someone feels the urge to bet. Coins are made up and can't be bought or cashed out. */
export default function Arcade({ wallet, setWallet, onDone }: { wallet: Wallet; setWallet: (f: (w: Wallet) => Wallet) => void; onDone: (after: "much" | "bit" | "same" | "more" | null, rounds: number) => void }) {
  const [game, setGame] = useState<GameId | null>(null);
  const [rounds, setRounds] = useState(0);
  const [rating, setRating] = useState(false);
  const [seen, setSeen] = useState(0); // the round count at which the reminder was last closed
  const nudge = rounds > 0 && rounds % NUDGE_AT === 0 && seen !== rounds;
  const settle = useCallback((delta: number) => { setWallet((w) => ({ ...w, coins: Math.max(0, w.coins + delta) })); setRounds((n) => n + 1); }, [setWallet]);
  const coins = wallet.coins;

  if (rating) {
    return (
      <div className="card stack">
        <h2 className="display">How is the urge now?</h2>
        {([["much", "Much less"], ["bit", "A bit less"], ["same", "About the same"], ["more", "Stronger"]] as const).map(([k, l]) => (
          <button key={k} className="btn soft" onClick={() => onDone(k, rounds)}>{l}</button>
        ))}
        <p className="fine">If it&rsquo;s still strong, you&rsquo;re not alone. <Link href="/groups">Open a group</Link> and talk to someone now.</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="display ptitle">Play instead</h1>
      <p className="muted">Bet made-up coins on a quick game. No real money, ever. Coins can&rsquo;t be bought or cashed out.</p>
      <div className="card row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <b className="display" style={{ fontSize: 26 }} aria-label={`${coins} coins`}>🪙 {coins}</b>
        <span className="fine">+10 every day · +30 for each day without a bet</span>
      </div>
      {nudge && (
        <Sheet center onClose={() => setSeen(rounds)}>
          <h3 className="display">That&rsquo;s {rounds} rounds</h3>
          <p>Take a moment. How is the urge? You can stop whenever you like.</p>
          <button className="btn primary" onClick={() => { setSeen(rounds); setRating(true); }}>I&rsquo;m done for now</button>
          <Link className="btn soft" href="/groups">Talk to a group</Link>
          <button className="btn soft" onClick={() => { window.location.hash = "breathe"; }}>Breathe</button>
          <button className="btn ghost" onClick={() => setSeen(rounds)}>Keep playing</button>
        </Sheet>
      )}
      {coins < 1 && (
        <div className="card stack" role="status">
          <b>You&rsquo;re out of coins for today.</b>
          <span className="muted">You get 10 more tomorrow. For now you can still throw the ball yourself (free), breathe, or talk to someone.</span>
          <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Link className="btn soft sm" href="/groups">Talk to a group</Link>
            <button className="btn ghost sm" onClick={() => { window.location.hash = "breathe"; }}>Breathe</button>
          </span>
        </div>
      )}
      {game === null ? (
        <div className="stack">
          {GAMES.map((g) => (
            <button key={g.id} className="card row adm-line" style={{ textAlign: "left", gap: 12, cursor: "pointer" }} onClick={() => setGame(g.id)} disabled={coins < 1 && g.id !== "throw"}>
              <span style={{ fontSize: 30 }} aria-hidden="true">{g.emoji}</span>
              <span><b>{g.name}</b><br /><span className="muted">{g.blurb}</span></span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <button className="btn ghost sm" onClick={() => setGame(null)}>← All games</button>
          <h2 className="display">{GAMES.find((g) => g.id === game)?.name}</h2>
          <p className="card fine" style={{ margin: 0 }}><span><b>How to play:</b> {GAMES.find((g) => g.id === game)?.how}</span></p>
          {game === "throw" && <BallThrow coins={coins} settle={settle} />}
          {game === "race" && <Race coins={coins} settle={settle} />}
          {game === "hilo" && <HiLo coins={coins} settle={settle} />}
          {game === "trip" && <LagosTrip coins={coins} settle={settle} />}
          {game === "tug" && <Tug coins={coins} settle={settle} />}
        </>
      )}
      <button className="btn primary" onClick={() => setRating(true)}>I&rsquo;m done. Take me back</button>
      <p className="fine">These are for fun and to ride out an urge. They don&rsquo;t change real odds or money.</p>
    </>
  );
}
