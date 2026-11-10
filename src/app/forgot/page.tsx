"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { passwordProblem, QUESTIONS } from "@/lib/identity";

type Reply = { ok: boolean; status: number; j: { questions?: string[]; username?: string; error?: string; message?: string } };
async function call(body: object): Promise<Reply> {
  try {
    const r = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) };
  } catch { return { ok: false, status: 0, j: { message: "No connection. Check your data and try again." } }; }
}

/** The last 24 months, newest first, as YYYY-MM. Used only if two accounts share the same answers. */
const months = () => Array.from({ length: 24 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return { v: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, l: d.toLocaleString("en-GB", { month: "long", year: "numeric" }) }; });

export default function Forgot() {
  const [mode, setMode] = useState<"pw" | "name">("pw");
  useEffect(() => { if (new URLSearchParams(window.location.search).get("find")) setMode("name"); }, []);
  const switchTo = (m: "pw" | "name") => { setMode(m); };
  return (
    <div className="pg-narrow">
      <div className="topbar"><Link className="wordmark display" href="/">Therapia</Link></div>
      <div><h1 className="display ptitle">{mode === "pw" ? "Forgot your password?" : "Forgot your username?"}</h1><p className="muted">Your two security questions get you back in.</p></div>
      <div className="seg" role="group" aria-label="What did you forget" style={{ justifySelf: "start" }}>
        <button type="button" aria-pressed={mode === "pw"} onClick={() => switchTo("pw")}>My password</button>
        <button type="button" aria-pressed={mode === "name"} onClick={() => switchTo("name")}>My username</button>
      </div>
      {mode === "pw" ? <ForgotPassword /> : <ForgotUsername goPassword={() => switchTo("pw")} />}
    </div>
  );
}

function ForgotPassword() {
  const [username, setUsername] = useState("");
  const [qs, setQs] = useState<string[] | null>(null);
  const [a1, setA1] = useState("");
  const [a2, setA2] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function find(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await call({ action: "questions", username: username.trim() });
    setBusy(false);
    if (r.ok && r.j.questions?.length === 2) setQs(r.j.questions); else setErr(r.j.message ?? "Couldn't find that username.");
  }
  async function reset(e: React.FormEvent) {
    e.preventDefault();
    const p = passwordProblem(pw);
    if (p) { setErr(p); return; }
    setErr(""); setBusy(true);
    const r = await call({ action: "reset", username: username.trim(), a1, a2, newPassword: pw });
    setBusy(false);
    if (r.ok) setDone(true); else setErr(r.j.message ?? "Something went wrong. Try again.");
  }

  if (done) return <div className="card"><p><b>Your password is changed.</b></p><Link className="btn primary big" href="/login">Sign in</Link></div>;
  if (!qs) return (
    <form className="card" onSubmit={find}>
      <label className="stack"><span className="eyebrow">Username</span><input className="field" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" spellCheck={false} /></label>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn primary big" type="submit" disabled={busy || !username.trim()}>{busy ? "Looking…" : "Continue"}</button>
    </form>
  );
  return (
    <form className="card" onSubmit={reset}>
      <p><b>{qs[0]}</b></p>
      <input className="field" value={a1} onChange={(e) => setA1(e.target.value)} autoComplete="off" aria-label="Answer 1" placeholder="Your answer" />
      <p><b>{qs[1]}</b></p>
      <input className="field" value={a2} onChange={(e) => setA2(e.target.value)} autoComplete="off" aria-label="Answer 2" placeholder="Your answer" />
      <label className="stack"><span className="eyebrow">New password</span><input className="field" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></label>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn primary big" type="submit" disabled={busy || !a1.trim() || !a2.trim() || !pw}>{busy ? "Checking…" : "Set new password"}</button>
      <p className="fine">Both answers must be right. You get 5 tries per hour.</p>
    </form>
  );
}

function ForgotUsername({ goPassword }: { goPassword: () => void }) {
  const [a1, setA1] = useState("");
  const [a2, setA2] = useState("");
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [month, setMonth] = useState("");
  const [needMonth, setNeedMonth] = useState(false);
  const [found, setFound] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await call({ action: "find", a1, a2, month: month || undefined });
    setBusy(false);
    if (r.ok && r.j.username) { setFound(r.j.username); return; }
    if (r.j.error === "need_month") setNeedMonth(true);
    setErr(r.j.message ?? "Something went wrong. Try again.");
  }

  if (found) return (
    <div className="card">
      <p>Your username is</p>
      <p className="display ptitle" style={{ fontSize: 32 }}>{found}</p>
      <p className="fine">Write it down somewhere safe.</p>
      <Link className="btn primary big" href="/login">Sign in</Link>
      <button className="btn ghost" type="button" onClick={goPassword}>I forgot my password too</button>
    </div>
  );
  return (
    <form className="card" onSubmit={go}>
      <p className="muted">Pick the two questions you chose when you joined, then type your answers. Order does not matter.</p>
      <label className="stack"><span className="eyebrow">Security question 1</span>
        <select className="field" value={q1} onChange={(e) => setQ1(e.target.value)}>
          <option value="">Pick the question you chose…</option>
          {QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
          <option value="custom">One I wrote myself</option>
        </select>
        <input className="field" value={a1} onChange={(e) => setA1(e.target.value)} autoComplete="off" aria-label="Answer to question 1" placeholder="Your answer" />
      </label>
      <label className="stack"><span className="eyebrow">Security question 2</span>
        <select className="field" value={q2} onChange={(e) => setQ2(e.target.value)}>
          <option value="">Pick the question you chose…</option>
          {QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
          <option value="custom">One I wrote myself</option>
        </select>
        <input className="field" value={a2} onChange={(e) => setA2(e.target.value)} autoComplete="off" aria-label="Answer to question 2" placeholder="Your answer" />
      </label>
      {needMonth && (
        <label className="stack"><span className="eyebrow">Month you created your account</span>
          <select className="field" value={month} onChange={(e) => setMonth(e.target.value)}><option value="">Choose…</option>{months().map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}</select>
        </label>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn primary big" type="submit" disabled={busy || !a1.trim() || !a2.trim() || (needMonth && !month)}>{busy ? "Looking…" : "Find my username"}</button>
      <p className="fine">You get 10 tries per hour.</p>
    </form>
  );
}
