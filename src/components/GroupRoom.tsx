"use client";

import Link from "next/link";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";
import { authPost } from "@/lib/api";
import { useMembership } from "@/lib/join";
import { hostLabel, type RoomDef, UNASSIGNED } from "@/lib/rooms";
import GroupChat from "./GroupChat";
import { useQuickExit } from "./QuickExit";
import RoomView from "./RoomView";
import { HelpSheet } from "./ui";
import Vent from "./Vent";

type Tab = "meeting" | "chat" | "vent";
type Joined = { token: string; url: string };

/**
 * One screen for a group. You are inside as soon as you join: Chat and Vent always work.
 * The Meeting tab shows "waiting for the facilitator" until they arrive, then offers the live audio.
 */
export default function GroupRoom({ room, start }: { room: RoomDef; start: Tab }) {
  const { ready, checked, username, member, needCode, busy, error, join } = useMembership(room.id);
  const { exit: quickExit } = useQuickExit();
  const [tab, setTab] = useState<Tab>(start);
  const [code, setCode] = useState("");
  const [help, setHelp] = useState(false);
  const [live, setLive] = useState(false);
  const [joined, setJoined] = useState<Joined | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connErr, setConnErr] = useState("");
  const busyTok = useRef(false);

  // Is the facilitator in? Checked every few seconds while we are not already in the audio.
  useEffect(() => {
    if (!member || joined) return;
    let stop = false;
    const tick = async () => {
      try {
        const d = await fetch("/api/rooms", { cache: "no-store" }).then((r) => r.json());
        if (!stop && d.live) setLive(room.id in d.live);
      } catch { /* try again next time */ }
    };
    tick();
    const t = setInterval(tick, 6000);
    return () => { stop = true; clearInterval(t); };
  }, [member, joined, room.id]);

  async function enterAudio() {
    if (busyTok.current) return;
    busyTok.current = true;
    setConnecting(true);
    setConnErr("");
    try {
      const t = await authPost<{ token?: string; url?: string; error?: string; code?: string }>("/api/token", { roomId: room.id });
      if (t.status === 409 && t.data.code === "not_started") { setLive(false); return; }
      if (!t.ok || !t.data.token || !t.data.url) { setConnErr(t.data.error ?? "Couldn't start audio. Try again."); return; }
      setJoined({ token: t.data.token, url: t.data.url });
    } catch {
      setConnErr("No connection. Check your data and try again.");
    } finally {
      busyTok.current = false;
      setConnecting(false);
    }
  }

  const leaveAudio = () => { setJoined(null); setLive(false); };
  const header = (
    <div>
      <div className="rc-cat">{room.cat}{room.women ? " · Women only" : ""}</div>
      <h1 className="display ptitle" style={{ fontSize: 26 }}>{room.title}</h1>
      <p className="muted">{hostLabel(room.host)} · {room.next ?? room.when}{room.next ? "" : " WAT"}</p>
    </div>
  );

  if (!ready || !checked) return <div className="pg-narrow"><p className="muted">Loading…</p></div>;

  if (!member) {
    return (
      <div className="pg-narrow">
        <div className="topbar"><Link className="btn ghost sm" href="/groups">← Groups</Link></div>
        <div className={`hero ankara pal-${room.pal}`} aria-hidden="true" style={{ height: 110 }} />
        {header}
        <form className="card" onSubmit={(e) => { e.preventDefault(); join(code); }}>
          <p>Join this group to chat, vent and take part in its meetings. You will appear as <b>{username || "…"}</b>.</p>
          {needCode && (
            <label>
              <span className="eyebrow">Invite code</span>
              <input className="field" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="From your group host" style={{ marginTop: 6 }} />
            </label>
          )}
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn primary big" type="submit" disabled={busy}>{busy ? "Joining…" : "Join this group"}</button>
        </form>
        <p className="fine">Audio is never recorded. Chat messages disappear after 7 days. Phone numbers and links are blocked.</p>
      </div>
    );
  }

  const meeting = joined ? (
    <LiveKitRoom
      token={joined.token}
      serverUrl={joined.url}
      connect
      audio={false}
      video={false}
      options={{ publishDefaults: { dtx: true } }}
      onDisconnected={leaveAudio}
      onError={() => setConnErr("Connection problem. Check your data.")}
    >
      <RoomAudioRenderer />
      <RoomView room={room} host={member.isHost} token={joined.token} onLeave={leaveAudio} />
    </LiveKitRoom>
  ) : member.isHost ? (
    <div className="card meetcard">
      <p className="display" style={{ fontSize: 20, margin: 0 }}>{live ? "Your meeting is live" : "Ready to start?"}</p>
      <p className="muted">{live ? "You are already in. Join to take over this tab." : "Members can chat and vent now. Audio starts when you join."}</p>
      {connErr && <p className="err" role="alert">{connErr}</p>}
      <button className="btn accent big" onClick={enterAudio} disabled={connecting}>{connecting ? "Connecting…" : live ? "Join the meeting" : "Start the meeting"}</button>
    </div>
  ) : live ? (
    <div className="card meetcard" role="status" aria-live="polite">
      <p className="display" style={{ fontSize: 20, margin: 0 }}><span className="livepill"><i />Live now</span></p>
      <p className="muted">The facilitator is here. You join as a listener, and can raise your hand when you want to speak.</p>
      {connErr && <p className="err" role="alert">{connErr}</p>}
      <button className="btn accent big" onClick={enterAudio} disabled={connecting}>{connecting ? "Connecting…" : "Join the live meeting"}</button>
    </div>
  ) : (
    <div className="card meetcard" role="status" aria-live="polite">
      <p className="display" style={{ fontSize: 20, margin: 0 }}>Waiting for the facilitator</p>
      <p className="muted">{room.host === UNASSIGNED ? "The meeting starts once a facilitator is assigned and joins." : `The meeting starts when ${room.host} arrives.`} This page will show a Join button the moment they are in. Meanwhile, chat and vent are open.</p>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn soft" onClick={() => setTab("chat")}>Chat with the group</button>
        <button className="btn ghost" onClick={() => setTab("vent")}>Vent</button>
      </div>
    </div>
  );

  return (
    <div className={tab === "meeting" && joined ? "pg-wide" : "pg-narrow"}>
      <div className="topbar">
        <Link className="btn ghost sm" href="/groups">← Groups</Link>
        <span className="row"><button className="pill-help" onClick={() => setHelp(true)}>♥ Help</button><button className="btn ghost sm" onClick={quickExit}>Quick exit</button></span>
      </div>
      {help && <HelpSheet onClose={() => setHelp(false)} />}
      {header}
      <div className="tabs roomtabs" role="tablist">
        <button className="tab" role="tab" aria-selected={tab === "meeting"} onClick={() => setTab("meeting")}>Meeting{(joined || live) && <span className="count">●</span>}</button>
        <button className="tab" role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")}>Chat</button>
        <button className="tab" role="tab" aria-selected={tab === "vent"} onClick={() => setTab("vent")}>Vent</button>
      </div>
      <div hidden={tab !== "meeting"}>{meeting}</div>
      <div hidden={tab !== "chat"}><GroupChat roomId={room.id} alias={member.alias} isHost={member.isHost} /></div>
      <div hidden={tab !== "vent"}><Vent roomId={room.id} alias={member.alias} isHost={member.isHost} /></div>
    </div>
  );
}

