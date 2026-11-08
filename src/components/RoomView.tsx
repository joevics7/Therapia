"use client";

import { useLocalParticipant, useParticipants, useRoomContext } from "@livekit/components-react";
import { type Participant, RoomEvent } from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authPost } from "@/lib/api";
import { MAX_SPEAKERS, type RoomDef } from "@/lib/rooms";
import { avatarVar, initials } from "@/lib/session";
import GroupChat from "./GroupChat";
import { useQuickExit } from "./QuickExit";

type Hand = { identity: string; name: string };
const enc = new TextEncoder();
const dec = new TextDecoder();

const roleOf = (p: Participant) => {
  try { return (JSON.parse(p.metadata || "{}").role as string) || "listener"; } catch { return "listener"; }
};
const Avatar = ({ name, size }: { name: string; size: number }) => (
  <span className="av" style={{ "--s": `${size}px`, background: avatarVar(name) } as React.CSSProperties} aria-hidden="true">{initials(name)}</span>
);

type Props = { room: RoomDef; host: boolean; alias: string; token: string; onLeave: () => void };

export default function RoomView({ room, host, alias, token, onLeave }: Props) {
  const lk = useRoomContext();
  const { exit: quickExit } = useQuickExit();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [, bump] = useState(0);
  const [tab, setTab] = useState<"chat" | "hands">("chat");
  const [hands, setHands] = useState<Hand[]>([]);
  const [myHand, setMyHand] = useState(false);
  const [toast, setToast] = useState("");
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);

  const say = useCallback((m: string) => {
    setToast(m);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(""), 3200);
  }, []);

  const canSpeak = !!localParticipant.permissions?.canPublish;
  const speakers = useMemo(
    () => participants.filter((p) => roleOf(p) === "host" || p.permissions?.canPublish),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [participants, localParticipant.permissions?.canPublish],
  );
  const hostP = speakers.find((p) => roleOf(p) === "host");
  const guests = speakers.filter((p) => roleOf(p) !== "host");
  const listenerCount = participants.length - speakers.length;

  const send = useCallback((topic: string, payload: object) => {
    return lk.localParticipant.publishData(enc.encode(JSON.stringify(payload)), { reliable: true, topic });
  }, [lk]);

  // raised hands travel over the live audio connection (no storage)
  useEffect(() => {
    const onData = (payload: Uint8Array, p?: Participant, _k?: unknown, topic?: string) => {
      if (!p || topic !== "hand") return;
      let d: { type?: string };
      try { d = JSON.parse(dec.decode(payload)); } catch { return; }
      if (d.type === "raise") setHands((h) => (h.some((x) => x.identity === p.identity) ? h : [...h, { identity: p.identity, name: p.name || "Guest" }]));
      if (d.type === "lower") setHands((h) => h.filter((x) => x.identity !== p.identity));
    };
    const onLeft = (p: Participant) => setHands((h) => h.filter((x) => x.identity !== p.identity));
    const onJoined = () => { if (myHand) send("hand", { type: "raise" }).catch(() => {}); }; // lets a late host see raised hands
    const onPerm = (_prev: unknown, p: Participant) => {
      bump((n) => n + 1);
      if (p.permissions?.canPublish) setHands((h) => h.filter((x) => x.identity !== p.identity));
      if (p === lk.localParticipant) {
        if (p.permissions?.canPublish) { setMyHand(false); say("You can speak now. Tap the mic when you're ready."); }
        else { lk.localParticipant.setMicrophoneEnabled(false).catch(() => {}); }
      }
    };
    lk.on(RoomEvent.DataReceived, onData);
    lk.on(RoomEvent.ParticipantDisconnected, onLeft);
    lk.on(RoomEvent.ParticipantConnected, onJoined);
    lk.on(RoomEvent.ParticipantPermissionsChanged, onPerm);
    return () => {
      lk.off(RoomEvent.DataReceived, onData);
      lk.off(RoomEvent.ParticipantDisconnected, onLeft);
      lk.off(RoomEvent.ParticipantConnected, onJoined);
      lk.off(RoomEvent.ParticipantPermissionsChanged, onPerm);
    };
  }, [lk, myHand, send, say]);

  async function control(action: "allow" | "revoke" | "remove" | "end", identity?: string, useToken = false) {
    const r = await authPost("/api/room-control", { action, roomId: room.id, identity, token: useToken ? token : undefined });
    if (!r.ok) say("That didn't work. Try again.");
    return r.ok;
  }

  async function invite(h: Hand) {
    if (speakers.length >= MAX_SPEAKERS) { say("Stage is full. Ask someone to step down first."); return; }
    if (await control("allow", h.identity)) setHands((x) => x.filter((y) => y.identity !== h.identity));
  }

  async function toggleHand() {
    const next = !myHand;
    setMyHand(next);
    await send("hand", { type: next ? "raise" : "lower" }).catch(() => say("Couldn't send. Check your connection."));
    if (next) say("Hand raised. The host will see it.");
  }

  async function toggleMic() {
    try { await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled); }
    catch { say("Couldn't reach your microphone. Check your browser's permission."); }
  }

  async function stepDown() {
    await localParticipant.setMicrophoneEnabled(false).catch(() => {});
    if (await control("revoke", undefined, true)) say("You stepped down. Still listening.");
  }

  async function endRoom() { if (await control("end")) onLeave(); }
  const speaking = (p?: Participant) => !!p?.isSpeaking;

  return (
    <>
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => { lk.disconnect(); onLeave(); }}>Leave quietly</button>
        <span className="livepill"><i />Live</span>
        <button className="btn ghost sm" onClick={() => { lk.disconnect(); onLeave(); quickExit(); }}>Quick exit</button>
      </div>
      <div>
        <h1 className="display ptitle" style={{ fontSize: 22 }}>{room.title}</h1>
        <p className="fine">{room.cat}{room.women ? " · Women only" : ""}</p>
      </div>

      {host && (
        <div className="hostbar">
          <span className="eyebrow">Host tools</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn soft sm" onClick={endRoom}>End room for everyone</button>
          </div>
        </div>
      )}

      <div className="stage">
        {hostP ? (
          <div className={`member host${speaking(hostP) ? " speaking" : ""}`}>
            <Avatar name={hostP.name || "Host"} size={64} />
            <div><span className="nm">{hostP.name}</span><div className="fine">Host · facilitator</div></div>
          </div>
        ) : (
          <p className="muted">Waiting for the host to arrive. Stay here, the room starts when they join.</p>
        )}
        <div className="guests">
          {[0, 1, 2].map((i) => {
            const g = guests[i];
            if (!g) return <div className="member" key={i}><span className="empty-slot">+</span><span className="nm">Open slot</span></div>;
            return (
              <div className={`member${speaking(g) ? " speaking" : ""}`} key={g.identity}>
                <Avatar name={g.name || "Guest"} size={48} />
                <span className="nm">{g === localParticipant ? "You" : g.name}</span>
                {host && <button className="btn ghost sm" onClick={() => control("revoke", g.identity)}>Mute</button>}
              </div>
            );
          })}
        </div>
        <div className="fine"><b>{participants.length}</b> in the room · {listenerCount} listening</div>
      </div>

      <div className="tabs" role="tablist">
        <button className="tab" role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")}>Room chat</button>
        <button className="tab" role="tab" aria-selected={tab === "hands"} onClick={() => setTab("hands")}>Raised hands<span className="count">{hands.length}</span></button>
      </div>

      <div hidden={tab !== "chat"}><GroupChat roomId={room.id} alias={alias} isHost={host} compact /></div>
      <div className="panel" hidden={tab !== "hands"}>
        {hands.length === 0 && <p className="empty">No hands up right now.</p>}
        {hands.map((h) => (
          <div className="hand-row" key={h.identity}>
            <Avatar name={h.name} size={36} />
            <span className="hn">{h.name}</span>
            {host && (<>
              <button className="btn soft sm" onClick={() => invite(h)}>Invite</button>
              <button className="btn ghost sm" onClick={() => { control("remove", h.identity); setHands((x) => x.filter((y) => y.identity !== h.identity)); }}>Remove</button>
            </>)}
          </div>
        ))}
      </div>

      <div className="dock">
        <div className="act-row">
          {canSpeak ? (
            <>
              <button className={`btn ${isMicrophoneEnabled ? "accent" : "soft"}`} onClick={toggleMic}>{isMicrophoneEnabled ? "Mic on" : "Muted"}</button>
              {!host && <button className="btn ghost" onClick={stepDown}>Step down</button>}
            </>
          ) : (
            <button className={`btn ${myHand ? "soft" : "accent"}`} onClick={toggleHand}>{myHand ? "Lower hand" : "Raise hand"}</button>
          )}
        </div>
      </div>
    </>
  );
}
