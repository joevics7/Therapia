"use client";

import Link from "next/link";
import { useState } from "react";
import { useMembership } from "@/lib/join";
import type { RoomDef } from "@/lib/rooms";
import GroupChat from "./GroupChat";

/** The group's text chat, open any time. You need to be a member (women-only groups need the invite code once). */
export default function ChatClient({ room }: { room: RoomDef }) {
  const { ready, checked, authError, handle, member, needCode, busy, error, join } = useMembership(room.id);
  const [code, setCode] = useState("");

  const problem = authError === "not_configured"
    ? "Accounts aren't set up yet."
    : authError ? "Your account couldn't start. Anonymous sign-ins may be switched off in Supabase." : "";

  return (
    <>
      <div className="topbar">
        <Link className="btn ghost sm" href="/groups">← Groups</Link>
        <Link className="btn accent sm" href={`/room/${room.id}`}>Go to live room</Link>
      </div>
      <div>
        <div className="rc-cat">{room.cat}{room.women ? " · Women only" : ""}</div>
        <h1 className="display ptitle" style={{ fontSize: 26 }}>{room.title}</h1>
        <p className="muted">Group chat</p>
      </div>
      {!ready || !checked ? <p className="muted">Loading…</p> : member ? (
        <GroupChat roomId={room.id} alias={member.alias} isHost={member.isHost} />
      ) : (
        <form className="card" onSubmit={(e) => { e.preventDefault(); join(code); }}>
          <p>Join this group to read and write in its chat. You will appear as <b>{handle || "…"}</b>.</p>
          {needCode && (
            <label>
              <span className="eyebrow">Invite code</span>
              <input className="field" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="From your group host" style={{ marginTop: 6 }} />
            </label>
          )}
          {(problem || error) && <p className="err" role="alert">{problem || error}</p>}
          <button className="btn primary big" type="submit" disabled={busy || !handle || !!problem}>{busy ? "Joining…" : "Join this group"}</button>
        </form>
      )}
    </>
  );
}
