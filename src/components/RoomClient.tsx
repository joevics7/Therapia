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
  const { ready, username, member, needCode, busy, error, join } = useMembership(room.id);
  const [code, setCode] = useState("");
  const [custom, setCustom] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [joined, setJoined] = useState<Joined | null>(null);
  const [joining, setJoining] = useState(false);
  const [connErr, setConnErr] = useState("");

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setConnErr("");
    setJoining(true);
    try {
      const me = member ?? (await join(code, useCustom ? custom : ""));
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
        {member ? (
          <p>You are in this group as <b>{member.handle}</b>. You will start as a listener. Raise your hand when you want to speak.</p>
        ) : (
          <>
            <p>You will join as <b>{useCustom && custom.trim() ? custom.trim() : username || "…"}</b>. You start as a listener. Raise your hand when you want to speak.</p>
            <label className="check"><input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} />Use a different name in this group</label>
            {useCustom && <input className="field" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={32} placeholder="A name just for this group" aria-label="Name for this group" autoComplete="off" />}
          </>
        )}
        {needCode && (
          <label>
            <span className="eyebrow">Invite code</span>
            <input className="field" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="From your group host" style={{ marginTop: 6 }} />
          </label>
        )}
        {(error || connErr) && <p className="err" role="alert">{error || connErr}</p>}
        <button className="btn primary big" type="submit" disabled={busy || joining || !ready}>{busy || joining ? "Joining…" : "Join quietly"}</button>
      </form>
      <p className="fine">Audio is never recorded. Chat messages disappear after 7 days. Phone numbers and links are blocked.</p>
      <Link className="btn ghost" href={`/chat/${room.id}`}>Open the group chat only</Link>
    </div>
  );
}
