"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { useEffect, useState } from "react";
import type { RoomDef } from "@/lib/rooms";
import { getHandle, getHostKey, newHandle, setHandle, setHostKey } from "@/lib/session";
import RoomView from "./RoomView";

type Joined = { token: string; url: string; host: boolean };

export default function RoomClient({ room }: { room: RoomDef }) {
  const router = useRouter();
  const [handle, setH] = useState("");
  const [code, setCode] = useState("");
  const [hostKey, setHK] = useState("");
  const [showHost, setShowHost] = useState(false);
  const [joined, setJoined] = useState<Joined | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let h = getHandle();
    if (!h) { h = newHandle(); setHandle(h); }
    setH(h);
    const k = getHostKey();
    if (k) { setHK(k); setShowHost(true); }
  }, []);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, handle, code, hostKey }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't join. Try again."); return; }
      if (data.host) setHostKey(hostKey);
      setJoined(data);
    } catch {
      setError("No connection. Check your data and try again.");
    } finally {
      setBusy(false);
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
        onError={() => setError("Connection problem. Check your data.")}
      >
        <RoomAudioRenderer />
        <RoomView room={room} host={joined.host} handle={handle} token={joined.token} hostKey={hostKey} onLeave={leave} />
      </LiveKitRoom>
    );
  }

  return (
    <>
      <div className="topbar"><Link className="wordmark display" href="/groups">Therapia</Link></div>
      <div className={`hero ankara pal-${room.pal}`} aria-hidden="true" style={{ height: 110 }} />
      <div>
        <div className="rc-cat">{room.cat}</div>
        <h1 className="display ptitle" style={{ fontSize: 26 }}>{room.title}</h1>
        <p className="muted">Hosted by {room.host} · {room.when} WAT</p>
        {room.women && <p style={{ marginTop: 8 }}><span className="badge hib">Women only</span></p>}
      </div>
      <form className="card" onSubmit={join}>
        <p>You join as <b>{handle || "…"}</b>. You will start as a listener. Raise your hand when you want to speak.</p>
        {room.women && (
          <label>
            <span className="eyebrow">Invite code</span>
            <input className="field" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="From your group host" style={{ marginTop: 6 }} />
          </label>
        )}
        {showHost ? (
          <label>
            <span className="eyebrow">Host key</span>
            <input className="field" type="password" value={hostKey} onChange={(e) => setHK(e.target.value)} autoComplete="off" style={{ marginTop: 6 }} />
          </label>
        ) : (
          <button type="button" className="btn ghost sm" onClick={() => setShowHost(true)} style={{ justifySelf: "start" }}>I&rsquo;m the host</button>
        )}
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn primary big" type="submit" disabled={busy || !handle}>{busy ? "Joining…" : "Join quietly"}</button>
      </form>
      <p className="fine">Audio is never recorded. Phone numbers and links are blocked in chat.</p>
    </>
  );
}
