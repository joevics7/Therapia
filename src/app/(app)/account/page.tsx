"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { PageHead } from "@/components/ui";
import { authPost } from "@/lib/api";
import RecoveryFields, { emptyRecovery, toRecovery } from "@/components/RecoveryFields";
import { passwordProblem, recoveryProblem } from "@/lib/identity";
import { supabase } from "@/lib/supabase";
import { useStored } from "@/lib/store";
import { VoiceSettings } from "@/components/VoicePicker";
import { isVoiceId, type VoiceId } from "@/lib/voice";

export default function Account() {
  const { session, username, role, signOut } = useAuth();
  const staff = role !== "listener";

  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [rec, setRec] = useState(emptyRecovery());
  const [qPw, setQPw] = useState("");
  const [qMsg, setQMsg] = useState("");
  const [busy, setBusy] = useState("");

  const [voiceRaw, setVoice] = useStored<VoiceId>("voice", "natural");
  const voice = isVoiceId(voiceRaw) ? voiceRaw : "natural";
  const email = session?.user.email ?? "";

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    const p = passwordProblem(pw);
    if (p) { setPwMsg(p); return; }
    setBusy("pw"); setPwMsg("");
    const check = await supabase().auth.signInWithPassword({ email, password: cur });
    if (check.error) { setBusy(""); setPwMsg("Your current password didn't match."); return; }
    const { error } = await supabase().auth.updateUser({ password: pw });
    setBusy("");
    if (error) { setPwMsg("Couldn't change it. Try again."); return; }
    setCur(""); setPw(""); setPwMsg("Password changed.");
  }

  async function changeQuestion(e: React.FormEvent) {
    e.preventDefault();
    const r = toRecovery(rec);
    const p = recoveryProblem(r.q1, r.a1, r.q2, r.a2);
    if (p) { setQMsg(p); return; }
    setBusy("q"); setQMsg("");
    const res = await authPost<{ message?: string }>("/api/auth/recovery", { password: qPw, ...r });
    setBusy("");
    if (!res.ok) { setQMsg(res.data.message ?? "Couldn't save. Try again."); return; }
    setRec(emptyRecovery()); setQPw(""); setQMsg("Security questions saved.");
  }

  return (
    <div className="pg-narrow">
      <PageHead title="Account" sub={username ? `Signed in as ${username}` : "Signed in"} />

      {staff && (
        <div className="card">
          <p>You are signed in as a <b>{role}</b>.</p>
          <div className="row"><Link className="btn primary sm" href="/host">Host tools</Link></div>
        </div>
      )}

      {username && (
        <div className="card">
          <h2 className="sec-h display">Your name</h2>
          <p>In groups you appear as <b>{username}</b>. On any message you can tick <b>Hide my username</b> to send it without your name.</p>
        </div>
      )}

      <VoiceSettings value={voice} onChange={setVoice} />

      {!staff && (
        <>
          <form className="card" onSubmit={changePassword}>
            <h2 className="sec-h display">Change password</h2>
            <input className="field" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" placeholder="Current password" aria-label="Current password" />
            <input className="field" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" placeholder="New password" aria-label="New password" />
            {pwMsg && <p className={pwMsg === "Password changed." ? "notice" : "err"} role="status">{pwMsg}</p>}
            <button className="btn ghost" type="submit" disabled={busy === "pw" || !cur || !pw}>Change password</button>
          </form>

          <form className="card" onSubmit={changeQuestion}>
            <h2 className="sec-h display">Security questions</h2>
            <p className="muted">Two questions get you back in if you forget your password or your username. Saving replaces your old ones.</p>
            <RecoveryFields value={rec} onChange={setRec} />
            <input className="field" type="password" value={qPw} onChange={(e) => setQPw(e.target.value)} autoComplete="current-password" placeholder="Current password, to confirm" aria-label="Current password" />
            {qMsg && <p className={qMsg === "Security questions saved." ? "notice" : "err"} role="status">{qMsg}</p>}
            <button className="btn ghost" type="submit" disabled={busy === "q" || !rec.a1 || !rec.a2 || !qPw}>Save questions</button>
          </form>
        </>
      )}

      <button className="btn ghost" onClick={signOut}>Sign out</button>
      <p className="fine">Your mood log and journal stay on this device only. They are not part of your account.</p>
    </div>
  );
}
