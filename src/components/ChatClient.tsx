"use client";

import Link from "next/link";
import { HelpSheet } from "./ui";
import { useState } from "react";
import { useMembership } from "@/lib/join";
import type { RoomDef } from "@/lib/rooms";
import GroupChat from "./GroupChat";

/** The group's text chat, open any time. You need to be a member (women-only groups need the invite code once). */
export default function ChatClient({ room }: { room: RoomDef }) {
  const { ready, checked, username, member, needCode, busy, error, join } = useMembership(room.id);
  const [code, setCode] = useState("");
  const [help, setHelp] = useState(false);

  return (
    <div className="pg-narrow">
      <div className="topbar">
        <Link className="btn ghost sm" href="/groups">← Groups</Link>
        <span className="row"><button className="pill-help" onClick={() => setHelp(true)}>♥ Help</button><Link className="btn accent sm" href={`/room/${room.id}`}>Go to live room</Link></span>
      </div>
      {help && <HelpSheet onClose={() => setHelp(false)} />}
      <div>
        <div className="rc-cat">{room.cat}{room.women ? " · Women only" : ""}</div>
        <h1 className="display ptitle" style={{ fontSize: 26 }}>{room.title}</h1>
        <p className="muted">Group chat</p>
      </div>
      {!ready || !checked ? <p className="muted">Loading…</p> : member ? (
        <GroupChat roomId={room.id} alias={member.alias} isHost={member.isHost} />
      ) : (
        <form className="card" onSubmit={(e) => { e.preventDefault(); join(code); }}>
          <p>Join this group to read and write in its chat. You will appear as <b>{username || "…"}</b>.</p>
          {needCode && (
            <label>
              <span className="eyebrow">Invite code</span>
              <input className="field" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="From your group host" style={{ marginTop: 6 }} />
            </label>
          )}
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn primary big" type="submit" disabled={busy}>{busy ? "Joining…" : "Join this group"}</button>
        </form>
      )}
    </div>
  );
}
