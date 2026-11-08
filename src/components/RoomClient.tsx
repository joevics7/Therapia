"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { useState } from "react";
import { authPost } from "@/lib/api";
import { useMembership, type Member } from "@/lib/join";
import type { RoomDef } from "@/lib/rooms";
import RoomView from "./RoomView";

type Joined = { token: string; url: string; me: Member };

export default function RoomClient({ room }: { room: RoomDef }) {
  const router = useRouter();
  const { ready, authError, handle, needCode, busy, error, join } = useMembership(room.id);
  const [code, setCode] = useState("");
  const [joined, setJoined] = useState<Joined | null>(null);
  const [joining, setJoining] = useState(false);
  const [connErr, setConnErr] = useState("");

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setConnErr("");
    setJoining(true);
    try {
      const me = await join(code);
      if (!me) return;
      const t = await authPost<{ token?: string; url?: string; error?: string }>("/api/token", { roomId: room.id });
      if (!t.ok || !t.data.token || !t.data.url) { setConnErr(t.data.error ?? "Couldn't start audio. Try again."); return; }
      setJoined({ token: t.data.token, url: t.data.url, me });
    } catch {
      setConnErr("No connection. Check your data and try again.");
    } finally {
      setJoining(false);
    }
  }

  const leave = () => { setJoined(null); router.push("/groups"); };

  if (joined) {
    return (
      <LiveKitRoom
        token={joined.token}
        serverUrl={joined.url}
        connect
        audio={false}
        video={false}
        options={{ publishDefaults: { dtx: true } }}
        onDisconnected={leave}
        onError={() => setConnErr("Connection problem. Check your data.")}
      >
        <RoomAudioRenderer />
        <RoomView room={room} host={joined.me.isHost} alias={joined.me.alias} token={joined.token} onLeave={leave} />
      </LiveKitRoom>
    );
  }

  const problem = authError === "not_configured"
    ? "Accounts aren't set up yet. Add the Supabase values to .env.local."
    : authError ? "Your account couldn't start. Anonymous sign-ins may be switched off in Supabase." : "";

  return (
    <div className="pg-narrow">
      <div className="topbar"><Link className="wordmark display" href="/groups">Therapia</Link></div>
      <div className={`hero ankara pal-${room.pal}`} aria-hidden="true" style={{ height: 110 }} />
      <div>
        <div className="rc-cat">{room.cat}</div>
        <h1 className="display ptitle" style={{ fontSize: 26 }}>{room.title}</h1>
        <p className="muted">Hosted by {room.host} · {room.next ?? room.when}{room.next ? "" : " WAT"}</p>
        {room.women && <p style={{ marginTop: 8 }}><span className="badge hib">Women only</span></p>}
      </div>
      <form className="card" onSubmit={go}>
        <p>You join as <b>{handle || "…"}</b>. You will start as a listener. Raise your hand when you want to speak.</p>
        {needCode && (
          <label>
            <span className="eyebrow">Invite code</span>
            <input className="field" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="From your group host" style={{ marginTop: 6 }} />
          </label>
        )}
        {(problem || error || connErr) && <p className="err" role="alert">{problem || error || connErr}</p>}
        <button className="btn primary big" type="submit" disabled={busy || joining || !ready || !handle || !!problem}>{busy || joining ? "Joining…" : "Join quietly"}</button>
      </form>
      <p className="fine">Audio is never recorded. Chat messages disappear after 7 days. Phone numbers and links are blocked.</p>
      <Link className="btn ghost" href={`/chat/${room.id}`}>Open the group chat only</Link>
    </div>
  );
}
