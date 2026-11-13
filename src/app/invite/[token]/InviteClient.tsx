"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { supabase } from "@/lib/supabase";

type Preview = { ok: boolean; room_id?: string; title?: string; closed?: boolean; women_only?: boolean; error?: string };

function Invite({ token }: { token: string }) {
  const router = useRouter();
  const [pv, setPv] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"" | "pending" | "declined">("");
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase().rpc("invite_preview", { p_token: token }).then(({ data, error }) => setPv(error || !data ? { ok: false, error: "invalid" } : (data as Preview)));
  }, [token]);

  async function accept() {
    setBusy(true); setErr("");
    const { data, error } = await supabase().rpc("accept_invite", { p_token: token });
    setBusy(false);
    const d = (data ?? {}) as { ok?: boolean; status?: string; room_id?: string; error?: string };
    if (error || !d.ok) {
      setErr(d.error === "blocked" ? "You can't join this group." : d.error === "slow_down" ? "Too many requests. Try again later." : d.error === "invalid" ? "This invitation is no longer valid." : "Couldn't join. Try again.");
      return;
    }
    if (d.status === "pending" || d.status === "declined") { setStatus(d.status); return; }
    router.replace(`/room/${d.room_id}`);
  }

  return (
    <div className="pg-narrow">
      <div className="topbar"><Link className="wordmark display" href="/dashboard">Therapia</Link></div>
      {pv === null ? <p className="muted">Loading…</p> : !pv.ok ? (
        <div className="card stack">
          <p className="display" style={{ fontSize: 20, margin: 0 }}>This invitation isn&rsquo;t valid</p>
          <p className="muted">The link may have been switched off or replaced. Ask the person who sent it for a new one, or browse the groups yourself.</p>
          <Link className="btn primary" href="/groups">See groups</Link>
        </div>
      ) : status === "pending" ? (
        <div className="card stack" role="status">
          <p className="display" style={{ fontSize: 20, margin: 0 }}>Request sent</p>
          <p className="muted">The host of {pv.title} will review it. Once approved, the group appears under Groups and you can open it. Nothing else is needed from you.</p>
          <Link className="btn primary" href="/groups">Back to groups</Link>
        </div>
      ) : status === "declined" ? (
        <div className="card stack" role="status">
          <p className="display" style={{ fontSize: 20, margin: 0 }}>Not approved</p>
          <p className="muted">The host didn&rsquo;t approve this request. There are other groups you can join.</p>
          <Link className="btn primary" href="/groups">See groups</Link>
        </div>
      ) : (
        <div className="card stack">
          <p className="eyebrow">You were invited by a member</p>
          <h1 className="display ptitle" style={{ fontSize: 26, margin: 0 }}>{pv.title}</h1>
          <p className="muted">{pv.closed ? "This is a closed group. The host will see that a member invited you and decide whether to let you in." : "You can join now. The host will see that a member invited you."} You appear by your username, never your real name.</p>
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn primary big" onClick={accept} disabled={busy}>{busy ? "One moment…" : pv.closed ? "Ask to join" : "Join this group"}</button>
        </div>
      )}
    </div>
  );
}

export default function InviteClient({ token }: { token: string }) {
  return <RequireAuth><Invite token={token} /></RequireAuth>;
}
