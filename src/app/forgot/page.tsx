"use client";

import Link from "next/link";
import { useState } from "react";
import { passwordProblem } from "@/lib/identity";

export default function Forgot() {
  const [username, setUsername] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function call(body: object) {
    try {
      const r = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return { ok: r.ok, j: (await r.json().catch(() => ({}))) as { question?: string; message?: string } };
    } catch { return { ok: false, j: { message: "No connection. Check your data and try again." } }; }
  }

  async function find(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const r = await call({ action: "question", username: username.trim() });
    setBusy(false);
    if (r.ok && r.j.question) setQuestion(r.j.question); else setErr(r.j.message ?? "Couldn't find that username.");
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    const p = passwordProblem(pw);
    if (p) { setErr(p); return; }
    setErr(""); setBusy(true);
    const r = await call({ action: "reset", username: username.trim(), answer, newPassword: pw });
    setBusy(false);
    if (r.ok) setDone(true); else setErr(r.j.message ?? "Something went wrong. Try again.");
  }

  return (
    <div className="pg-narrow">
      <div className="topbar"><Link className="wordmark display" href="/">Therapia</Link></div>
      <div><h1 className="display ptitle">Forgot your password?</h1><p className="muted">Answer your security question to set a new one.</p></div>
      {done ? (
        <div className="card"><p><b>Your password is changed.</b></p><Link className="btn primary big" href="/login">Sign in</Link></div>
      ) : !question ? (
        <form className="card" onSubmit={find}>
          <label className="stack"><span className="eyebrow">Username</span><input className="field" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" spellCheck={false} /></label>
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn primary big" type="submit" disabled={busy || !username.trim()}>{busy ? "Looking…" : "Continue"}</button>
          <p className="fine">Forgot your username too? We can&rsquo;t look it up from an answer, because accounts have no email or phone. Try the names you usually use.</p>
        </form>
      ) : (
        <form className="card" onSubmit={reset}>
          <p><b>{question}</b></p>
          <input className="field" value={answer} onChange={(e) => setAnswer(e.target.value)} autoComplete="off" aria-label="Your answer" placeholder="Your answer" />
          <label className="stack"><span className="eyebrow">New password</span><input className="field" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></label>
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn primary big" type="submit" disabled={busy || !answer.trim() || !pw}>{busy ? "Checking…" : "Set new password"}</button>
          <p className="fine">You get 5 tries per hour.</p>
        </form>
      )}
    </div>
  );
}
