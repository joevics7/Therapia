"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createAccount, safeNext, signInWithUsername } from "@/lib/auth-actions";
import RecoveryFields, { emptyRecovery, toRecovery } from "@/components/RecoveryFields";
import { generateUsername, passwordProblem, recoveryProblem, usernameProblem } from "@/lib/identity";

function Login() {
  const router = useRouter();
  const { ready, session, error: authError } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [rec, setRec] = useState(emptyRecovery());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState("/dashboard");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setNext(safeNext(p.get("next")));
    if (p.get("mode") === "up") setMode("up");
  }, []);
  useEffect(() => { if (ready && session) router.replace(next); }, [ready, session, next, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (mode === "up") {
      const r = toRecovery(rec);
      const p = usernameProblem(username) || passwordProblem(password) || recoveryProblem(r.q1, r.a1, r.q2, r.a2);
      if (p) { setErr(p); return; }
    } else if (!username.trim() || !password) { setErr("Enter your username and password."); return; }
    setBusy(true);
    const r = mode === "up"
      ? await createAccount({ username: username.trim(), password, ...toRecovery(rec) })
      : await signInWithUsername(username.trim(), password);
    setBusy(false);
    if (r) setErr(r);
  }

  return (
    <div className="pg-narrow">
      <div className="topbar"><Link className="wordmark display" href="/">Therapia</Link></div>
      <div>
        <h1 className="display ptitle">{mode === "in" ? "Welcome back" : "Make your name"}</h1>
        <p className="muted">{mode === "in" ? "Sign in with your username and password." : "No email. No phone number. Just a username and a password."}</p>
      </div>
      <div className="seg" role="group" aria-label="Sign in or create account" style={{ justifySelf: "start" }}>
        <button type="button" aria-pressed={mode === "in"} onClick={() => { setMode("in"); setErr(""); }}>Sign in</button>
        <button type="button" aria-pressed={mode === "up"} onClick={() => { setMode("up"); setErr(""); }}>Create account</button>
      </div>

      <form className="card" onSubmit={submit}>
        {mode === "up" && <div className="notice"><b>Stay anonymous.</b> Don&rsquo;t use your real name, phone number or anything that points to you. Pick a made-up name, or let us make one.</div>}
        <label className="stack">
          <span className="eyebrow">Username</span>
          <input className="field" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={20} placeholder={mode === "up" ? "e.g. CalmBaobab482" : undefined} />
        </label>
        {mode === "up" && <button type="button" className="btn soft sm" onClick={() => setUsername(generateUsername())}>🎲 Generate a name for me</button>}
        {mode === "up" && <p className="fine">3 to 20 letters, numbers or underscores. This is the name people see in your groups. Write it down, you will need it to sign in.</p>}
        <label className="stack">
          <span className="eyebrow">Password</span>
          <input className="field" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} />
        </label>
        <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />Show password</label>

        {mode === "up" && (
          <>
            <div className="notice"><b>Two security questions</b> are how you get back in if you forget your password or your username. Pick questions only you can answer, and answers you will remember.</div>
            <RecoveryFields value={rec} onChange={setRec} />
            <p className="fine">Write your username down too. If you forget it, your two answers can find it again.</p>
          </>
        )}

        {(err || authError === "not_configured") && <p className="err" role="alert">{err || "Accounts aren't set up yet."}</p>}
        <button className="btn primary big" type="submit" disabled={busy || authError === "not_configured"}>{busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}</button>
        {mode === "in" && <p className="fine"><Link href="/forgot">Forgot your password?</Link> · <Link href="/forgot?find=1">Forgot your username?</Link></p>}
      </form>
      <p className="fine"><Link href="/host/login">Facilitator sign-in</Link></p>
    </div>
  );
}

export default function Page() { return <Suspense fallback={null}><Login /></Suspense>; }
