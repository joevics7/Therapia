"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMembership } from "@/lib/join";
import { hostLabel, type RoomDef } from "@/lib/rooms";
import GroupChat from "./GroupChat";
import { useQuickExit } from "./QuickExit";
import RoomView from "./RoomView";
import { useMeeting } from "./MeetingProvider";
import { HelpSheet } from "./ui";
import Vent from "./Vent";
import InviteSheet from "./InviteSheet";
import GroupIntro from "./GroupIntro";
import { supabase } from "@/lib/supabase";

type Tab = "meeting" | "chat" | "vent";

/**
 * One screen for a group. You are inside as soon as you join: Chat and Vent are the main tabs and always work.
 * A status pill says whether the meeting has started. The Meeting tab appears when it is live (the host always has it, to start it).
 */
export default function GroupRoom({ room, start }: { room: RoomDef; start: Tab }) {
  const { ready, checked, username, member, needCode, busy, error, join } = useMembership(room.id);
  const { exit: quickExit } = useQuickExit();
  // Chat and Vent are the main tabs. The Meeting tab only exists while the meeting is on (always for the host, who starts it).
  const [tab, setTab] = useState<Tab>(start === "meeting" ? "chat" : start);
  const [code, setCode] = useState("");
  const [help, setHelp] = useState(false);
  const [invite, setInvite] = useState(false);
  const [reqStatus, setReqStatus] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [declined, setDeclined] = useState(false); // the member chose to leave this live meeting
  const m = useMeeting();
  const inHere = m.active?.roomId === room.id;
  const isLive = live || inHere;
  const hasMeeting = isLive || !!member?.isHost;
  const shown: Tab = tab === "meeting" && !hasMeeting ? "chat" : tab;
  const wantedMeeting = useRef(start === "meeting"); // opened from a "go to the meeting" link: switch over once, when it is live
  const connecting = m.status === "connecting";
  const connErr = m.error;

  // The meeting screen is open, so the top bar is not needed.
  useEffect(() => {
    m.stage(shown === "meeting" && inHere);
    return () => m.stage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, inHere]);

  useEffect(() => { if (wantedMeeting.current && isLive) { wantedMeeting.current = false; setTab("meeting"); } }, [isLive]);

  // Is the facilitator in? Checked every few seconds while we are not already in the audio.
  useEffect(() => {
    if (!member || inHere) return;
    let stop = false;
    const tick = async () => {
      try {
        const d = await fetch("/api/rooms", { cache: "no-store" }).then((r) => r.json());
        if (!stop && d.live) {
          const on = room.id in d.live;
          setLive(on);
          if (!on) wantedMeeting.current = false; // only land on the meeting if it was already live when we arrived; later we show a banner instead
        }
      } catch { /* try again next time */ }
    };
    tick();
    const t = setInterval(tick, 6000);
    return () => { stop = true; clearInterval(t); };
  }, [member, inHere, room.id]);

  // Someone who asked to join through an invitation sees where their request stands.
  useEffect(() => {
    if (member || !checked) return;
    supabase().rpc("my_join_request", { p_room: room.id }).then(({ data }) => setReqStatus(typeof data === "string" ? data : null));
  }, [member, checked, room.id]);

  async function enterAudio() {
    if (!member) return;
    const r = await m.join({ id: room.id, title: room.title }, member.isHost);
    if (r === "not_started") setLive(false);
  }
  const leaveHere = async () => { setDeclined(true); setLive(false); await m.leave(); };

  // Members go straight into the live meeting when it is on and they are looking at the Meeting tab. No extra button.
  const autoTried = useRef(false); // try once per live meeting; after a failure the member taps "Try again"
  useEffect(() => { if (!live) { setDeclined(false); autoTried.current = false; } }, [live]);
  useEffect(() => {
    if (member && !member.isHost && shown === "meeting" && live && !inHere && !declined && m.status === "idle" && !autoTried.current) { autoTried.current = true; enterAudio(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, shown, live, inHere, declined, m.status]);

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
        {reqStatus === "pending" && <div className="card" role="status"><p><b>Your request to join is waiting for the host.</b> You&rsquo;ll be able to open this group once it&rsquo;s approved.</p></div>}
        {reqStatus === "declined" && <div className="card" role="status"><p>The host didn&rsquo;t approve your request to join this group.</p></div>}
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

  const meeting = inHere ? (
    <RoomView room={room} host={member.isHost} onLeave={leaveHere} />
  ) : member.isHost ? (
    <div className="card meetcard">
      <p className="display" style={{ fontSize: 20, margin: 0 }}>{live ? "Your meeting is live" : "Ready to start?"}</p>
      <p className="muted">{live ? "You are already in. Join to take over this tab." : "Members can chat and vent now. Audio starts when you join."}</p>
      {connErr && <p className="err" role="alert">{connErr}</p>}
      <button className="btn accent big" onClick={enterAudio} disabled={connecting}>{connecting ? "Connecting…" : live ? "Join the meeting" : "Start the meeting"}</button>
    </div>
  ) : live ? (
    <div className="card meetcard" role="status" aria-live="polite">
      <p className="display" style={{ fontSize: 20, margin: 0 }}>The meeting is live</p>
      {declined ? <p className="muted">You left the meeting.</p> : connErr ? <p className="err" role="alert">{connErr}</p> : <p className="muted">Joining the live meeting…</p>}
      {(declined || connErr) && <button className="btn accent big" onClick={() => { setDeclined(false); enterAudio(); }} disabled={connecting}>{connecting ? "Connecting…" : declined ? "Rejoin the meeting" : "Try again"}</button>}
    </div>
  ) : null;

  return (
    <div className={shown === "meeting" && inHere ? "pg-wide" : "pg-narrow"}>
      <div className="topbar roomtop">
        <Link className="btn ghost sm" href="/groups">← Groups</Link>
        <button className="btn soft sm" onClick={() => setInvite(true)}>+ Invite</button>
        <button className="pill-help" onClick={() => setHelp(true)}>♥ Help</button>
        <button className="btn ghost sm" onClick={quickExit}>Quick exit</button>
      </div>
      {help && <HelpSheet onClose={() => setHelp(false)} />}
      {invite && <InviteSheet roomId={room.id} title={room.title} onClose={() => setInvite(false)} />}
      {header}
      {!inHere && <div>{isLive ? <span className="livepill"><i />Live now</span> : <span className="livepill off">Not yet started</span>}</div>}
      {!isLive && <GroupIntro room={room} />}
      {isLive && shown !== "meeting" && !member.isHost && (
        <div className="card row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }} role="status">
          <span><b>The meeting is live.</b> <span className="muted">Join to listen.</span></span>
          <button className="btn accent sm" onClick={() => setTab("meeting")}>Join</button>
        </div>
      )}
      <div className="tabs roomtabs" role="tablist">
        {hasMeeting && <button className="tab" role="tab" aria-selected={shown === "meeting"} onClick={() => setTab("meeting")}>Meeting{isLive && <span className="count">●</span>}</button>}
        <button className="tab" role="tab" aria-selected={shown === "chat"} onClick={() => setTab("chat")}>Chat</button>
        <button className="tab" role="tab" aria-selected={shown === "vent"} onClick={() => setTab("vent")}>Vent</button>
      </div>
      {hasMeeting && <div hidden={shown !== "meeting"}>{meeting}</div>}
      <div hidden={shown !== "chat"}><GroupChat roomId={room.id} alias={member.alias} isHost={member.isHost} /></div>
      <div hidden={shown !== "vent"}><Vent roomId={room.id} alias={member.alias} isHost={member.isHost} /></div>
    </div>
  );
}

