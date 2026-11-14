"use client";

import { StartAudio, useLocalParticipant, useParticipants, useRoomContext } from "@livekit/components-react";
import { type Participant, RoomEvent } from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Track, createLocalAudioTrack, type LocalAudioTrack } from "livekit-client";
import { authPost } from "@/lib/api";
import { VoicePicker } from "./VoicePicker";
import { useStored } from "@/lib/store";
import { VoiceProcessor, isVoiceId, type VoiceId } from "@/lib/voice";
import { MAX_SPEAKERS, type RoomDef } from "@/lib/rooms";
import { avatarVar, initials } from "@/lib/session";

type Hand = { identity: string; name: string };
const enc = new TextEncoder();
const dec = new TextDecoder();

const roleOf = (p: Participant) => {
  try { return (JSON.parse(p.metadata || "{}").role as string) || "listener"; } catch { return "listener"; }
};
const Avatar = ({ name, size }: { name: string; size: number }) => (
  <span className="av" style={{ "--s": `${size}px`, background: avatarVar(name) } as React.CSSProperties} aria-hidden="true">{initials(name)}</span>
);

/** A small live bar that moves with the person's voice, so you can see the microphone is working. */
function Level({ p }: { p?: Participant }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setV(p?.audioLevel ?? 0), 120);
    return () => clearInterval(t);
  }, [p]);
  return <div className="level" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.round(v * 160))}%` }} /></div>;
}

type Props = { room: RoomDef; host: boolean; token: string; onLeave: () => void };

export default function RoomView({ room, host, token, onLeave }: Props) {
  const lk = useRoomContext();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [, bump] = useState(0);
  const [hands, setHands] = useState<Hand[]>([]);
  const [myHand, setMyHand] = useState(false);
  const [toast, setToast] = useState("");
  const [voiceRaw, setVoice] = useStored<VoiceId>("voice", "natural");
  const voice: VoiceId = isVoiceId(voiceRaw) ? voiceRaw : "natural";
  const proc = useRef<VoiceProcessor | null>(null);
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

  // The voice effect is attached BEFORE the track is published, so your natural voice is never sent by mistake.
  async function toggleMic() {
    try {
      if (isMicrophoneEnabled) {
        await localParticipant.setMicrophoneEnabled(false);
        proc.current = null;
        return;
      }
      const track: LocalAudioTrack = await createLocalAudioTrack();
      if (voice !== "natural") {
        const p = new VoiceProcessor(voice);
        try { await track.setProcessor(p); proc.current = p; }
        catch { track.stop(); say("Your voice effect couldn't start, so the mic stayed off."); return; }
      }
      await localParticipant.publishTrack(track, { source: Track.Source.Microphone });
    } catch { say("Couldn't reach your microphone. Check your browser's permission."); }
  }

  // Changing the voice while speaking updates the live effect.
  useEffect(() => {
    const pub = localParticipant.getTrackPublication(Track.Source.Microphone);
    const track = pub?.track as LocalAudioTrack | undefined;
    if (!track) return;
    const cur = track.getProcessor();
    if (cur instanceof VoiceProcessor) { cur.setVoice(voice); return; }
    if (voice !== "natural") {
      const p = new VoiceProcessor(voice);
      track.setProcessor(p).then(() => { proc.current = p; }).catch(() => {});
    }
  }, [voice, localParticipant, isMicrophoneEnabled]);

  async function stepDown() {
    await localParticipant.setMicrophoneEnabled(false).catch(() => {});
    if (await control("revoke", undefined, true)) say("You stepped down. Still listening.");
  }

  async function endRoom() { if (await control("end")) onLeave(); }
  const speaking = (p?: Participant) => !!p?.isSpeaking;

  return (
    <div className="room meet">
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
      <StartAudio label="Tap to turn on sound" className="btn accent big" />
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <span className="livepill"><i />{hostP ? "Live now" : "Host is joining…"}</span>
        <button className="btn ghost sm" onClick={() => { lk.disconnect(); onLeave(); }}>Leave the meeting</button>
      </div>

      {host && (
        <div className="hostbar">
          <span className="eyebrow">Host tools</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn soft sm" onClick={endRoom}>End room for everyone</button>
          </div>
        </div>
      )}

      <div className="room-cols">
      <div className="stage">
        {hostP ? (
          <div className={`member host${speaking(hostP) ? " speaking" : ""}`}>
            <Avatar name={hostP.name || "Host"} size={64} />
            <div style={{ flex: 1, minWidth: 0 }}><span className="nm">{hostP === localParticipant ? "You" : hostP.name}</span><div className="fine">Host · facilitator{speaking(hostP) ? " · speaking" : ""}</div><Level p={hostP} /></div>
          </div>
        ) : (
          <p className="muted">Waiting for the host to arrive.</p>
        )}
        <div className="guests">
          {[0, 1, 2].map((i) => {
            const g = guests[i];
            if (!g) return <div className="member" key={i}><span className="empty-slot">+</span><span className="nm">Open slot</span></div>;
            return (
              <div className={`member${speaking(g) ? " speaking" : ""}`} key={g.identity}>
                <Avatar name={g.name || "Guest"} size={48} />
                <span className="nm">{g === localParticipant ? "You" : g.name}</span>
                <Level p={g} />
                {host && <button className="btn ghost sm" onClick={() => control("revoke", g.identity)}>Mute</button>}
              </div>
            );
          })}
        </div>
        <div className="fine"><b>{participants.length}</b> in the room · {listenerCount} listening</div>
      </div>

      <div className="room-side">
      <h2 className="sec-h display" style={{ margin: 0, fontSize: 17 }}>Raised hands<span className="count">{hands.length}</span></h2>
      <div className="panel">
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

      </div>

      <div className="dock">
        <div className="eyebrow">Your voice</div>
        <VoicePicker value={voice} onChange={setVoice} />
        <div className="act-row">
          {canSpeak ? (
            <>
              <div className="microw">
                <button className={`btn big ${isMicrophoneEnabled ? "accent" : "soft"}`} onClick={toggleMic}>{isMicrophoneEnabled ? "🎙 Mic is ON · tap to mute" : "🔇 Mic is OFF · tap to turn on"}</button>
                {isMicrophoneEnabled && <Level p={localParticipant} />}
              </div>
              {!host && <button className="btn ghost" onClick={stepDown}>Step down</button>}
            </>
          ) : (
            <button className={`btn ${myHand ? "soft" : "accent"}`} onClick={toggleHand}>{myHand ? "Lower hand" : "Raise hand"}</button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
