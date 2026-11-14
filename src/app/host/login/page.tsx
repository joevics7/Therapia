"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { emailFor } from "@/lib/identity";
import { supabase } from "@/lib/supabase";

export default function HostLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabase().auth.signInWithPassword({ email: email.includes("@") ? email.trim() : emailFor(email), password });
    setBusy(false);
    if (error) { setErr("That email or password didn't work."); return; }
    router.push("/host");
  }

  return (
    <div className="pg-narrow">
      <div className="topbar"><Link className="wordmark display" href="/">Therapia</Link></div>
      <div><h1 className="display ptitle">Facilitator sign-in</h1><p className="muted">For verified group hosts. Listeners don&rsquo;t need to sign in.</p></div>
      <form className="card" onSubmit={submit}>
        <label htmlFor="em" className="eyebrow">Email</label>
        <input id="em" className="field" type="text" inputMode="email" autoCapitalize="none" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="pw" className="eyebrow">Password</label>
        <input id="pw" className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary big" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="fine">Facilitator accounts are created by a Therapia admin after verification. Forgot your password? Ask an admin to reset it.</p>
    </div>
  );
}
