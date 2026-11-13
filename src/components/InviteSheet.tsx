"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Sheet } from "./ui";

/** Each member has their own invitation link for each group. */
export default function InviteSheet({ roomId, title, onClose }: { roomId: string; title: string; onClose: () => void }) {
  const [inv, setInv] = useState<{ token: string; active: boolean } | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  async function call(action: "get" | "reset" | "off" | "on") {
    setErr("");
    const { data, error } = await supabase().rpc("my_invite", { p_room: roomId, p_action: action });
    if (error || !data) { setErr("Couldn't load your link. Try again."); return; }
    setInv(data as { token: string; active: boolean });
  }
  useEffect(() => { call("get"); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [roomId]);

  const link = inv ? `${window.location.origin}/invite/${inv.token}` : "";
  const text = `I'd like you to join "${title}" on Therapia, a private, anonymous support space. No real names needed.`;

  async function copy() {
    try { await navigator.clipboard.writeText(link); setNote("Link copied."); } catch { setNote("Press and hold the link to copy it."); }
  }
  async function share() {
    try { await navigator.share({ title: "Therapia", text, url: link }); } catch { /* cancelled */ }
  }

  return (
    <Sheet onClose={onClose}>
      <h3 className="display">Invite someone to this group</h3>
      <p className="muted">This is your own link for {title}. If this group is closed (password or women-only), the host approves each person who asks to join. Otherwise they can join straight away.</p>
      {err && <p className="err" role="alert">{err}</p>}
      {inv && (
        <>
          <input className="field" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Your invitation link" disabled={!inv.active} />
          {!inv.active && <p className="fine">Your link is switched off. Nobody can use it.</p>}
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="btn primary" onClick={copy} disabled={!inv.active}>Copy link</button>
            {typeof navigator !== "undefined" && "share" in navigator && <button className="btn soft" onClick={share} disabled={!inv.active}>Share</button>}
            {inv.active ? <button className="btn ghost" onClick={() => call("off")}>Turn link off</button> : <button className="btn ghost" onClick={() => call("on")}>Turn link on</button>}
            <button className="btn ghost" onClick={() => call("reset")}>Make a new link</button>
          </div>
          {note && <p className="fine" role="status">{note}</p>}
        </>
      )}
      <p className="fine">The host can see that you invited the person, and the person is told they were invited by a member. Other members never see it. Only invite people you trust. If someone misbehaves, the host can remove them.</p>
      <button className="btn ghost big" onClick={onClose}>Close</button>
    </Sheet>
  );
}
