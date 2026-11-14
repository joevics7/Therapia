"use client";

import { StartAudio, useLocalParticipant, useParticipants, useRoomContext } from "@livekit/components-react";
import { LocalAudioTrack, type Participant, RoomEvent, Track } from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authPost } from "@/lib/api";
import { VoicePicker } from "./VoicePicker";
import { useStored } from "@/lib/store";
import { buildVoiceGraph, isVoiceId, VOICES, type VoiceGraph, type VoiceId } from "@/lib/voice";
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

type Pipe = { mic: MediaStream; ctx: AudioContext; graph: VoiceGraph; track: LocalAudioTrack };
type Props = { room: RoomDef; host: boolean; token: string; onLeave: (manual?: boolean) => void };

/**
 * The live meeting, laid out like an audio space: speakers on top, everyone else listed below as listeners,
 * and one big button at the bottom that shows whether you are muted and lets you ask to speak.
 */
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
  const pipe = useRef<Pipe | null>(null);
  const [micBusy, setMicBusy] = useState(false);
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
  const listeners = participants.filter((p) => !speakers.includes(p));
  const handSet = new Set(hands.map((h) => h.identity));
  const sortedListeners = [...listeners].sort((a, b) => Number(handSet.has(b.identity)) - Number(handSet.has(a.identity)));

  const send = useCallback((topic: string, payload: object) => {
    return lk.localParticipant.publishData(enc.encode(JSON.stringify(payload)), { reliable: true, topic });
  }, [lk]);

  const stopMic = useCallback(async () => {
    const p = pipe.current;
    if (!p) return;
    pipe.current = null;
    try { await lk.localParticipant.unpublishTrack(p.track, true); } catch { /* already gone */ }
    p.graph.dispose();
    p.mic.getTracks().forEach((t) => t.stop());
    p.ctx.close().catch(() => {});
    bump((n) => n + 1);
  }, [lk]);

  // Everyone sees who is muted, speaking, and who is in the room, so refresh when any of that changes.
  useEffect(() => {
    const again = () => bump((n) => n + 1);
    const evs = [RoomEvent.ActiveSpeakersChanged, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished];
    evs.forEach((e) => lk.on(e, again));
    return () => { evs.forEach((e) => lk.off(e, again)); };
  }, [lk]);

  // raised hands travel over the live audio connection (no storage)
  useEffect(() => {
    const onData = (payload: Uint8Array, p?: Participant, _k?: unknown, topic?: string) => {
      if (!p || topic !== "hand") return;
      let d: { type?: string; to?: string };
      try { d = JSON.parse(dec.decode(payload)); } catch { return; }
      if (d.type === "raise") setHands((h) => (h.some((x) => x.identity === p.identity) ? h : [...h, { identity: p.identity, name: p.name || "Guest" }]));
      if (d.type === "lower") setHands((h) => h.filter((x) => x.identity !== p.identity));
      if (d.type === "declined" && roleOf(p) === "host" && d.to === lk.localParticipant.identity) { setMyHand(false); say("The host can't bring you up right now."); }
    };
    const onLeft = (p: Participant) => setHands((h) => h.filter((x) => x.identity !== p.identity));
    const onJoined = () => { if (myHand) send("hand", { type: "raise" }).catch(() => {}); }; // lets a late host see raised hands
    const onPerm = (_prev: unknown, p: Participant) => {
      bump((n) => n + 1);
      if (p.permissions?.canPublish) setHands((h) => h.filter((x) => x.identity !== p.identity));
      if (p === lk.localParticipant) {
        if (p.permissions?.canPublish) { setMyHand(false); say("You can speak now. Tap the mic when you're ready."); }
        else stopMic();
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
  }, [lk, myHand, send, say, stopMic]);

  useEffect(() => () => { stopMic(); }, [stopMic]);

  async function control(action: "allow" | "revoke" | "remove" | "end", identity?: string, useToken = false) {
    const r = await authPost("/api/room-control", { action, roomId: room.id, identity, token: useToken ? token : undefined });
    if (!r.ok) say("That didn't work. Try again.");
    return r.ok;
  }

  async function invite(h: Participant) {
    if (speakers.length >= MAX_SPEAKERS) { say("The stage is full. Move someone back to listeners first."); return; }
    if (await control("allow", h.identity)) setHands((x) => x.filter((y) => y.identity !== h.identity));
  }
  function decline(h: Participant) {
    setHands((x) => x.filter((y) => y.identity !== h.identity));
    send("hand", { type: "declined", to: h.identity }).catch(() => {});
  }

  async function toggleHand() {
    const next = !myHand;
    setMyHand(next);
    await send("hand", { type: next ? "raise" : "lower" }).catch(() => say("Couldn't send. Check your connection."));
    if (next) say("Hand raised. The host will see it.");
  }

  // The microphone goes through our own voice effect first, and only the changed voice is ever published.
  async function toggleMic() {
    if (micBusy) return;
    if (pipe.current) { await stopMic(); return; }
    setMicBusy(true);
    let mic: MediaStream | null = null;
    const ctx = new AudioContext(); // created inside the tap so phones allow it
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (ctx.state === "suspended") await ctx.resume();
      const dest = ctx.createMediaStreamDestination();
      const graph = await buildVoiceGraph(ctx, ctx.createMediaStreamSource(mic), dest, voice);
      if (VOICES[voice].pitch !== 1 && !graph.pitchAvailable) {
        graph.dispose();
        throw new Error("no_pitch"); // never fall back to someone's natural voice by accident
      }
      const track = new LocalAudioTrack(dest.stream.getAudioTracks()[0], undefined, false);
      await lk.localParticipant.publishTrack(track, { source: Track.Source.Microphone });
      pipe.current = { mic, ctx, graph, track };
      bump((n) => n + 1);
    } catch (e) {
      mic?.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
      say((e as Error).message === "no_pitch" ? "This phone can't change your voice that way, so the mic stayed off. Pick Natural or Bass boost." : "Couldn't reach your microphone. Check your browser's permission.");
    } finally {
      setMicBusy(false);
    }
  }

  // Changing the voice while speaking updates the live effect.
  useEffect(() => { pipe.current?.graph.setVoice(voice); }, [voice]);

  async function stepDown() {
    await stopMic();
    if (await control("revoke", undefined, true)) say("You stepped down. Still listening.");
  }

  async function endRoom() { if (await control("end")) onLeave(false); }
  const speaking = (p?: Participant) => !!p?.isSpeaking;
  const you = (p: Participant) => p === localParticipant;
  const mic = (p: Participant) => (you(p) ? isMicrophoneEnabled : p.isMicrophoneEnabled);

  return (
    <div className="room meet">
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
      <StartAudio label="Tap to turn on sound" className="btn accent big" />
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <span className="livepill"><i />{hostP ? "Live now" : "Host is joining…"}</span>
        <button className="btn ghost sm" onClick={() => { lk.disconnect(); onLeave(true); }}>Leave quietly</button>
      </div>

      {host && (
        <div className="hostbar">
          <span className="eyebrow">Host tools</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn soft sm" onClick={endRoom}>End room for everyone</button>
            {hands.length > 0 && <span className="badge">✋ {hands.length} hand{hands.length === 1 ? "" : "s"} up</span>}
          </div>
        </div>
      )}

      <section className="stage" aria-label="Speakers">
        <div className="eyebrow">Speakers</div>
        {hostP ? (
          <div className={`member host${speaking(hostP) ? " speaking" : ""}`}>
            <Avatar name={hostP.name || "Host"} size={64} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="nm">{you(hostP) ? "You" : hostP.name}</span>
              <div className="fine">Host · facilitator {mic(hostP) ? "· 🎙 mic on" : "· 🔇 muted"}{speaking(hostP) ? " · speaking" : ""}</div>
              <Level p={hostP} />
            </div>
          </div>
        ) : (
          <p className="muted">Waiting for the host to arrive.</p>
        )}
        {(guests.length > 0 || host) && (
          <div className="guests">
            {guests.map((g) => (
              <div className={`member${speaking(g) ? " speaking" : ""}`} key={g.identity}>
                <Avatar name={g.name || "Guest"} size={52} />
                <span className="nm">{you(g) ? "You" : g.name}</span>
                <span className="fine">{mic(g) ? "🎙 on" : "🔇 muted"}</span>
                <Level p={g} />
                {host && <button className="btn ghost sm" onClick={() => control("revoke", g.identity)}>Move to listeners</button>}
              </div>
            ))}
            {host && guests.length === 0 && <p className="fine" style={{ gridColumn: "1 / -1" }}>Nobody else is speaking. Invite a listener who has raised a hand.</p>}
          </div>
        )}
      </section>

      <section className="stage" aria-label="Listeners">
        <div className="eyebrow">Listeners · {listeners.length}</div>
        {listeners.length === 0 && <p className="fine">No listeners yet.</p>}
        <div className="lgrid">
          {sortedListeners.map((p) => {
            const hand = handSet.has(p.identity);
            return (
              <div className={`ltile${hand ? " hand" : ""}`} key={p.identity}>
                <span className="lav"><Avatar name={p.name || "Guest"} size={44} />{hand && <span className="handbadge" aria-label="Hand raised">✋</span>}</span>
                <span className="nm">{you(p) ? "You" : p.name}</span>
                {host && hand && (
                  <span className="row" style={{ gap: 4, justifyContent: "center" }}>
                    <button className="btn soft sm" onClick={() => invite(p)}>Invite</button>
                    <button className="btn ghost sm" onClick={() => decline(p)}>Not now</button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="dock">
        {canSpeak ? (
          <>
            <div className="microw">
              <button className={`btn big ${isMicrophoneEnabled ? "accent" : "soft"}`} onClick={toggleMic} disabled={micBusy}>{micBusy ? "Starting…" : isMicrophoneEnabled ? "🎙 Mic is ON · tap to mute" : "🔇 Mic is OFF · tap to turn on"}</button>
              {isMicrophoneEnabled && <Level p={localParticipant} />}
            </div>
            {!host && <button className="btn ghost" onClick={stepDown}>Step down to listen</button>}
          </>
        ) : (
          <button className={`btn big mutedbtn${myHand ? " up" : ""}`} onClick={toggleHand} aria-pressed={myHand}>
            {myHand ? <>✋ Hand raised<small>Waiting for the host. Tap to lower your hand.</small></> : <>🔇 You&rsquo;re muted<small>Tap to ask the host to let you speak</small></>}
          </button>
        )}
        <details className="voicebox">
          <summary>Change how my voice sounds</summary>
          <VoicePicker value={voice} onChange={setVoice} />
          <p className="fine">{VOICES[voice].hint}. Others only ever hear the changed voice. Use headphones to avoid echo.</p>
        </details>
      </div>
    </div>
  );
}
