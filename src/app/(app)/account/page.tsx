"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { PageHead } from "@/components/ui";
import { credentialsFor, generatePhrase, isRecoveryEmail, normalizePhrase, phraseValid } from "@/lib/recovery";
import { supabase } from "@/lib/supabase";

export default function Account() {
  const router = useRouter();
  const { ready, session, isAnonymous, role, error, signOut } = useAuth();
  const [phrase, setPhrase] = useState("");
  const [written, setWritten] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [restore, setRestore] = useState("");
  const [copied, setCopied] = useState(false);

  const email = session?.user.email;
  const backedUp = !isAnonymous && isRecoveryEmail(email);
  const staff = !isAnonymous && !isRecoveryEmail(email);

  async function activate() {
    setBusy(true);
    setMsg("");
    try {
      const c = await credentialsFor(phrase);
      const { error: e } = await supabase().auth.updateUser({ email: c.email, password: c.password });
      if (e) { setMsg(`Backup didn't start (${e.message}).`); return; }
      await supabase().auth.refreshSession();
      const { data } = await supabase().auth.getUser();
      if (data.user?.is_anonymous) {
        setMsg("Backup isn't active yet. The app owner needs to turn off email confirmation in Supabase Auth settings, then try again.");
      } else {
        setPhrase("");
        setWritten(false);
        setMsg("Backup is on. Keep your phrase safe.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function doRestore(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!phraseValid(restore)) { setMsg("A recovery phrase has 6 words from the list. Check the spelling."); return; }
    setBusy(true);
    try {
      const c = await credentialsFor(restore);
      const { error: err } = await supabase().auth.signInWithPassword({ email: c.email, password: c.password });
      if (err) { setMsg("That phrase didn't match an account."); return; }
      router.push("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(phrase); setCopied(true); } catch { setMsg("Couldn't copy. Please write the words down."); }
  };

  if (!ready) return <p className="muted">Loading…</p>;
  if (error) return (<><PageHead title="Account" /><div className="card"><p className="err">{error === "not_configured" ? "Accounts aren't set up yet." : "Your account couldn't start. Anonymous sign-ins may be switched off in Supabase."}</p></div></>);

  return (
    <>
      <PageHead title="Account" sub="No email. No phone number." />

      {staff ? (
        <div className="card">
          <p>You are signed in as a <b>{role}</b>.</p>
          <div className="row"><Link className="btn primary sm" href="/host">Host tools</Link><button className="btn ghost sm" onClick={signOut}>Sign out</button></div>
        </div>
      ) : backedUp ? (
        <div className="card">
          <p><b>Backup is on.</b> Your 6-word phrase restores this account on a new phone. If you lose it, nobody can recover the account, not even us.</p>
        </div>
      ) : (
        <section className="card">
          <h2 className="sec-h display">Back up this account</h2>
          <p className="muted">Right now your account lives only on this phone. A recovery phrase lets you get it back on another phone. Bookings and saved items come with it.</p>
          {!phrase ? (
            <button className="btn primary" onClick={() => { setPhrase(generatePhrase()); setWritten(false); setCopied(false); setMsg(""); }}>Create my phrase</button>
          ) : (
            <div className="stack">
              <ol className="phrase" aria-label="Your recovery phrase">{phrase.split(" ").map((w, i) => <li key={i}>{w}</li>)}</ol>
              <div className="row"><button className="btn ghost sm" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button><button className="btn ghost sm" onClick={() => setPhrase(generatePhrase())}>New words</button></div>
              <p className="fine">Write these words down in order and keep them private. Anyone with them can open your account. We can&rsquo;t show them again.</p>
              <label className="check"><input type="checkbox" checked={written} onChange={(e) => setWritten(e.target.checked)} />I have written my phrase down</label>
              <button className="btn primary" disabled={!written || busy} onClick={activate}>{busy ? "Turning on…" : "Turn on backup"}</button>
            </div>
          )}
        </section>
      )}

      {!staff && (
        <form className="card" onSubmit={doRestore}>
          <h2 className="sec-h display">Already have a phrase?</h2>
          <p className="muted">Enter it to open your account on this phone. This replaces the account currently on this phone.</p>
          <label htmlFor="restore" className="eyebrow">Your 6 words</label>
          <input id="restore" className="field" value={restore} onChange={(e) => setRestore(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="word word word word word word" />
          {restore && !phraseValid(restore) && <p className="fine">{normalizePhrase(restore).split(" ").filter(Boolean).length} of 6 words</p>}
          <button className="btn ghost" type="submit" disabled={busy || !restore.trim()}>Restore my account</button>
        </form>
      )}

      {msg && <p className="notice" role="status">{msg}</p>}
      <p className="fine">Your mood log and journal stay on this phone only. They are not part of the backup.</p>
    </>
  );
}
