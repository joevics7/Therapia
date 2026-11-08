"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createAccount, safeNext, signInWithUsername } from "@/lib/auth-actions";
import { answerProblem, CUSTOM_QUESTION, passwordProblem, QUESTIONS, questionProblem, usernameProblem } from "@/lib/identity";

function Login() {
  const router = useRouter();
  const { ready, session, error: authError } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [qSel, setQSel] = useState(QUESTIONS[0]);
  const [qCustom, setQCustom] = useState("");
  const [answer, setAnswer] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState("/dashboard");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setNext(safeNext(p.get("next")));
    if (p.get("mode") === "up") setMode("up");
  }, []);
  useEffect(() => { if (ready && session) router.replace(next); }, [ready, session, next, router]);

  const question = qSel === CUSTOM_QUESTION ? qCustom : qSel;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (mode === "up") {
      const p = usernameProblem(username) || passwordProblem(password) || questionProblem(question) || answerProblem(answer);
      if (p) { setErr(p); return; }
    } else if (!username.trim() || !password) { setErr("Enter your username and password."); return; }
    setBusy(true);
    const r = mode === "up"
      ? await createAccount({ username: username.trim(), password, question: question.trim(), answer })
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
        <label className="stack">
          <span className="eyebrow">Username</span>
          <input className="field" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={20} />
        </label>
        {mode === "up" && <p className="fine">3 to 20 letters, numbers or underscores. This is the name people see in your groups. You can use another name in any group.</p>}
        <label className="stack">
          <span className="eyebrow">Password</span>
          <input className="field" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} />
        </label>
        <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />Show password</label>

        {mode === "up" && (
          <>
            <div className="notice"><b>If you forget your password</b>, a security question lets you set a new one. Pick a question only you can answer.</div>
            <label className="stack">
              <span className="eyebrow">Security question</span>
              <select className="field" value={qSel} onChange={(e) => setQSel(e.target.value)}>
                {[...QUESTIONS, CUSTOM_QUESTION].map((q) => <option key={q}>{q}</option>)}
              </select>
            </label>
            {qSel === CUSTOM_QUESTION && <input className="field" value={qCustom} onChange={(e) => setQCustom(e.target.value)} maxLength={120} placeholder="Your question" aria-label="Your own question" />}
            <label className="stack">
              <span className="eyebrow">Your answer</span>
              <input className="field" value={answer} onChange={(e) => setAnswer(e.target.value)} autoComplete="off" />
            </label>
            <p className="fine">Write your username down somewhere safe. If you forget it, we can&rsquo;t look it up, because we don&rsquo;t know who you are.</p>
          </>
        )}

        {(err || authError === "not_configured") && <p className="err" role="alert">{err || "Accounts aren't set up yet."}</p>}
        <button className="btn primary big" type="submit" disabled={busy || authError === "not_configured"}>{busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}</button>
        {mode === "in" && <p className="fine"><Link href="/forgot">Forgot your password?</Link></p>}
      </form>
      <p className="fine"><Link href="/host/login">Facilitator sign-in</Link></p>
    </div>
  );
}

export default function Page() { return <Suspense fallback={null}><Login /></Suspense>; }
