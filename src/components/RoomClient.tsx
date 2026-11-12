"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";
import { authPost } from "@/lib/api";
import { useMembership, type Member } from "@/lib/join";
import type { RoomDef } from "@/lib/rooms";
import RoomView from "./RoomView";

type Joined = { token: string; url: string; me: Member };

export default function RoomClient({ room }: { room: RoomDef }) {
  const router = useRouter();
  const { ready, username, member, needCode, busy, error, join } = useMembership(room.id);
  const [code, setCode] = useState("");
  const [joined, setJoined] = useState<Joined | null>(null);
  const [joining, setJoining] = useState(false);
  const [connErr, setConnErr] = useState("");
  const [waiting, setWaiting] = useState<Member | null>(null); // joined the group, facilitator not in yet
  const busyTok = useRef(false);

  // Asks for an audio token. Listeners only get one once the facilitator is in the room.
  async function connect(me: Member) {
    if (busyTok.current) return;
    busyTok.current = true;
    try {
      const t = await authPost<{ token?: string; url?: string; error?: string; code?: string }>("/api/token", { roomId: room.id });
      if (t.status === 409 && t.data.code === "not_started") { setWaiting(me); return; }
      if (!t.ok || !t.data.token || !t.data.url) { setWaiting(null); setConnErr(t.data.error ?? "Couldn't start audio. Try again."); return; }
      setWaiting(null);
      setJoined({ token: t.data.token, url: t.data.url, me });
    } catch {
      setConnErr("No connection. Check your data and try again.");
    } finally {
      busyTok.current = false;
    }
  }

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setConnErr("");
    setJoining(true);
    try {
      const me = member ?? (await join(code));
      if (!me) return;
      await connect(me);
    } finally {
      setJoining(false);
    }
  }

  // While waiting, check every few seconds. The moment the facilitator is in, the person is let in.
  useEffect(() => {
    if (!waiting) return;
    let stop = false;
    const tick = async () => {
      try {
        const d = await fetch("/api/rooms", { cache: "no-store" }).then((r) => r.json());
        if (!stop && d.live && room.id in d.live) connect(waiting);
      } catch { /* try again next time */ }
    };
    const t = setInterval(tick, 6000);
    return () => { stop = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, room.id]);

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
      {waiting && (
        <div className="card waitcard" role="status" aria-live="polite">
          <p className="display" style={{ fontSize: 20, margin: 0 }}>Waiting for the facilitator</p>
          <p className="muted">The audio room opens when {room.host} arrives. You are in the group. Keep this page open and we will take you in the moment they join.</p>
          <Link className="btn accent big" href={`/chat/${room.id}`}>Chat with the group while you wait</Link>
          <button className="btn ghost" type="button" onClick={() => setWaiting(null)}>Stop waiting</button>
        </div>
      )}
      {!waiting && <form className="card" onSubmit={go}>
        {member ? (
          <p>You are in this group as <b>{member.handle}</b>. You will start as a listener. Raise your hand when you want to speak.</p>
        ) : (
          <>
            <p>You will join as <b>{username || "…"}</b>. You start as a listener. Raise your hand when you want to speak.</p>
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
      </form>}
      <p className="fine">Audio is never recorded. Chat messages disappear after 7 days. Phone numbers and links are blocked.</p>
      <Link className="btn ghost" href={`/chat/${room.id}`}>Open the group chat only</Link>
    </div>
  );
}
