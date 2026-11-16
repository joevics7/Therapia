"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { LocalAudioTrack, Participant, Room } from "livekit-client";
import { authPost } from "@/lib/api";
import { useStored } from "@/lib/store";
import { MAX_SPEAKERS } from "@/lib/rooms";
import { buildVoiceGraph, isVoiceId, VOICES, type VoiceGraph, type VoiceId } from "@/lib/voice";
import { useAuth } from "./AuthProvider";

/**
 * The live meeting lives here, above every page, so it keeps going while people move around the app.
 * You can browse, read or chat while listening or speaking. A bar at the top shows you are still in it.
 */

export type PInfo = { identity: string; name: string; role: "host" | "listener"; canPublish: boolean; speaking: boolean; micOn: boolean; local: boolean };
export type Active = { roomId: string; title: string; isHost: boolean };
export type JoinResult = "ok" | "not_started" | "error";

type Meeting = {
  active: Active | null;
  status: "idle" | "connecting" | "live";
  error: string;
  participants: PInfo[];
  me: PInfo | null;
  hands: string[]; // identities with a raised hand
  myHand: boolean;
  micBusy: boolean;
  needSound: boolean;
  voice: VoiceId;
  setVoice: (v: VoiceId) => void;
  join: (room: { id: string; title: string }, isHost: boolean) => Promise<JoinResult>;
  leave: () => Promise<void>;
  enableSound: () => void;
  toggleMic: () => Promise<void>;
  toggleHand: () => Promise<void>;
  invite: (identity: string) => Promise<void>;
  decline: (identity: string) => void;
  moveToListeners: (identity: string) => Promise<void>;
  mute: (identity: string) => Promise<void>;
  ban: (identity: string) => Promise<boolean>;
  stepDown: () => Promise<void>;
  endRoom: () => Promise<void>;
  getLevel: (identity: string) => number;
  stage: (on: boolean) => void; // the meeting screen is open, so the top bar is hidden
  say: (m: string) => void;
};

const noop = async () => {};
const Ctx = createContext<Meeting>({
  active: null, status: "idle", error: "", participants: [], me: null, hands: [], myHand: false, micBusy: false, needSound: false,
  voice: "natural", setVoice: () => {}, join: async () => "error", leave: noop, enableSound: () => {}, toggleMic: noop, toggleHand: noop,
  invite: noop, decline: () => {}, moveToListeners: noop, mute: noop, ban: async () => false, stepDown: noop, endRoom: noop, getLevel: () => 0, stage: () => {}, say: () => {},
});
export const useMeeting = () => useContext(Ctx);

const enc = new TextEncoder();
const dec = new TextDecoder();
const roleOf = (p: Participant): "host" | "listener" => {
  try { return JSON.parse(p.metadata || "{}").role === "host" ? "host" : "listener"; } catch { return "listener"; }
};
const info = (p: Participant, local: boolean): PInfo => ({
  identity: p.identity, name: p.name || "Guest", role: roleOf(p), canPublish: !!p.permissions?.canPublish, speaking: p.isSpeaking, micOn: p.isMicrophoneEnabled, local,
});

type Pipe = { mic: MediaStream; ctx: AudioContext; graph: VoiceGraph; track: LocalAudioTrack };
type LK = typeof import("livekit-client");

export default function MeetingProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [active, setActive] = useState<Active | null>(null);
  const [status, setStatus] = useState<Meeting["status"]>("idle");
  const [error, setError] = useState("");
  const [participants, setParticipants] = useState<PInfo[]>([]);
  const [hands, setHands] = useState<string[]>([]);
  const [myHand, setMyHand] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [needSound, setNeedSound] = useState(false);
  const [onStage, setOnStage] = useState(false);
  const [notice, setNotice] = useState("");
  const [voiceRaw, setVoice] = useStored<VoiceId>("voice", "natural");
  const voice: VoiceId = isVoiceId(voiceRaw) ? voiceRaw : "natural";

  const roomRef = useRef<Room | null>(null);
  const lkRef = useRef<LK | null>(null);
  const tokenRef = useRef("");
  const activeRef = useRef<Active | null>(null);
  const pipe = useRef<Pipe | null>(null);
  const stopMicRef = useRef<() => Promise<void>>(async () => {});
  const audioBox = useRef<HTMLDivElement>(null);
  const joining = useRef(false);
  const handRef = useRef(false);
  const noticeT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const voiceRef = useRef<VoiceId>(voice);
  voiceRef.current = voice;

  const say = useCallback((m: string) => {
    setNotice(m);
    clearTimeout(noticeT.current);
    noticeT.current = setTimeout(() => setNotice(""), 3400);
  }, []);

  const refresh = useCallback(() => {
    const r = roomRef.current;
    if (!r) { setParticipants([]); return; }
    setParticipants([info(r.localParticipant, true), ...Array.from(r.remoteParticipants.values()).map((p) => info(p, false))]);
  }, []);

  const stopMic = useCallback(async () => {
    const p = pipe.current;
    if (!p) return;
    pipe.current = null;
    try { await roomRef.current?.localParticipant.unpublishTrack(p.track, true); } catch { /* already gone */ }
    p.graph.dispose();
    p.mic.getTracks().forEach((t) => t.stop());
    p.ctx.close().catch(() => {});
    refresh();
  }, [refresh]);
  useEffect(() => { stopMicRef.current = stopMic; }, [stopMic]);

  const send = useCallback((topic: string, payload: object) => {
    const r = roomRef.current;
    if (!r) return Promise.resolve();
    return r.localParticipant.publishData(enc.encode(JSON.stringify(payload)), { reliable: true, topic });
  }, []);

  const teardown = useCallback(async () => {
    const r = roomRef.current;
    roomRef.current = null;
    await stopMic();
    if (audioBox.current) audioBox.current.replaceChildren();
    try { r?.removeAllListeners(); await r?.disconnect(); } catch { /* ignore */ }
    activeRef.current = null; tokenRef.current = "";
    handRef.current = false;
    setActive(null); setStatus("idle"); setParticipants([]); setHands([]); setMyHand(false); setNeedSound(false);
  }, [stopMic]);

  const leave = useCallback(async () => { await teardown(); }, [teardown]);

  const attach = useCallback((room: Room, lk: LK) => {
    const again = () => refresh();
    for (const e of [lk.RoomEvent.ParticipantConnected, lk.RoomEvent.ParticipantDisconnected, lk.RoomEvent.ActiveSpeakersChanged, lk.RoomEvent.TrackMuted, lk.RoomEvent.TrackUnmuted,
      lk.RoomEvent.TrackPublished, lk.RoomEvent.TrackUnpublished, lk.RoomEvent.LocalTrackPublished, lk.RoomEvent.LocalTrackUnpublished, lk.RoomEvent.ParticipantMetadataChanged,
      lk.RoomEvent.ParticipantNameChanged]) room.on(e, again);

    // If the host mutes us, shut our mic fully so the button shows the truth and one tap turns it back on.
    room.on(lk.RoomEvent.TrackMuted, (_pub, p) => { if (p.isLocal && pipe.current) stopMicRef.current(); });

    // Sound from other people: every audio track is played through a hidden element.
    room.on(lk.RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== lk.Track.Kind.Audio) return;
      const el = track.attach();
      el.style.display = "none";
      audioBox.current?.appendChild(el);
    });
    room.on(lk.RoomEvent.TrackUnsubscribed, (track) => { track.detach().forEach((el) => el.remove()); });
    room.on(lk.RoomEvent.AudioPlaybackStatusChanged, () => setNeedSound(!room.canPlaybackAudio));
    room.on(lk.RoomEvent.Disconnected, () => { if (roomRef.current === room) { say("The meeting ended."); teardown(); } });

    // Raised hands travel over the live connection and are never stored.
    room.on(lk.RoomEvent.DataReceived, (payload, p, _k, topic) => {
      if (!p || topic !== "hand") return;
      let d: { type?: string; to?: string };
      try { d = JSON.parse(dec.decode(payload)); } catch { return; }
      if (d.type === "raise") setHands((h) => (h.includes(p.identity) ? h : [...h, p.identity]));
      if (d.type === "lower") setHands((h) => h.filter((x) => x !== p.identity));
      if (d.type === "declined" && roleOf(p) === "host" && d.to === room.localParticipant.identity) { handRef.current = false; setMyHand(false); say("The host can't bring you up right now."); }
    });
    room.on(lk.RoomEvent.ParticipantDisconnected, (p) => setHands((h) => h.filter((x) => x !== p.identity)));
    room.on(lk.RoomEvent.ParticipantConnected, () => { if (handRef.current) send("hand", { type: "raise" }).catch(() => {}); }); // a late host still sees raised hands
    room.on(lk.RoomEvent.ParticipantPermissionsChanged, (_prev, p) => {
      refresh();
      if (p.permissions?.canPublish) setHands((h) => h.filter((x) => x !== p.identity));
      if (p === room.localParticipant) {
        if (p.permissions?.canPublish) { handRef.current = false; setMyHand(false); say("You can speak now. Tap the mic when you're ready."); }
        else stopMic();
      }
    });
  }, [refresh, say, send, stopMic, teardown]);

  const join = useCallback<Meeting["join"]>(async (r, isHost) => {
    if (joining.current) return "error";
    if (activeRef.current?.roomId === r.id && roomRef.current) return "ok";
    joining.current = true;
    setStatus("connecting"); setError("");
    try {
      if (roomRef.current) await teardown(); // one meeting at a time
      setStatus("connecting");
      const t = await authPost<{ token?: string; url?: string; error?: string; code?: string }>("/api/token", { roomId: r.id });
      if (t.status === 409 && t.data.code === "not_started") { setStatus("idle"); return "not_started"; }
      if (!t.ok || !t.data.token || !t.data.url) { setError(t.data.error ?? "Couldn't start audio. Try again."); setStatus("idle"); return "error"; }
      const lk = (lkRef.current ??= await import("livekit-client"));
      const room = new lk.Room({ publishDefaults: { dtx: true } });
      roomRef.current = room;
      attach(room, lk);
      await room.connect(t.data.url, t.data.token);
      tokenRef.current = t.data.token;
      const a = { roomId: r.id, title: r.title, isHost };
      activeRef.current = a;
      setActive(a); setStatus("live"); setNeedSound(!room.canPlaybackAudio);
      room.startAudio().catch(() => {});
      refresh();
      return "ok";
    } catch {
      setError("No connection. Check your data and try again.");
      const rr = roomRef.current; roomRef.current = null;
      try { rr?.removeAllListeners(); await rr?.disconnect(); } catch { /* ignore */ }
      setStatus("idle");
      return "error";
    } finally {
      joining.current = false;
    }
  }, [attach, refresh, teardown]);

  const control = useCallback(async (action: "allow" | "revoke" | "remove" | "end" | "mute" | "ban", identity?: string, useToken = false) => {
    const a = activeRef.current;
    if (!a) return false;
    const r = await authPost("/api/room-control", { action, roomId: a.roomId, identity, token: useToken ? tokenRef.current : undefined });
    if (!r.ok) say("That didn't work. Try again.");
    return r.ok;
  }, [say]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current, lk = lkRef.current;
    if (!room || !lk || micBusy) return;
    if (pipe.current) { await stopMic(); return; }
    setMicBusy(true);
    let mic: MediaStream | null = null;
    const ctx = new AudioContext(); // created inside the tap so phones allow it
    const v = voiceRef.current;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (ctx.state === "suspended") await ctx.resume();
      const dest = ctx.createMediaStreamDestination();
      const graph = await buildVoiceGraph(ctx, ctx.createMediaStreamSource(mic), dest, v);
      if (VOICES[v].pitch !== 1 && !graph.pitchAvailable) {
        graph.dispose();
        throw new Error("no_pitch"); // never fall back to someone's natural voice by accident
      }
      const track = new lk.LocalAudioTrack(dest.stream.getAudioTracks()[0], undefined, false);
      await room.localParticipant.publishTrack(track, { source: lk.Track.Source.Microphone });
      pipe.current = { mic, ctx, graph, track };
      refresh();
    } catch (e) {
      mic?.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
      say((e as Error).message === "no_pitch" ? "This phone can't change your voice that way, so the mic stayed off. Pick Natural or Bass boost." : "Couldn't reach your microphone. Check your browser's permission.");
    } finally {
      setMicBusy(false);
    }
  }, [micBusy, refresh, say, stopMic]);

  // Changing the voice while speaking updates the live effect.
  useEffect(() => { pipe.current?.graph.setVoice(voice); }, [voice]);

  const toggleHand = useCallback(async () => {
    const next = !handRef.current;
    handRef.current = next;
    setMyHand(next);
    await send("hand", { type: next ? "raise" : "lower" }).catch(() => say("Couldn't send. Check your connection."));
    if (next) say("Hand raised. The host will see it.");
  }, [say, send]);

  const invite = useCallback(async (identity: string) => {
    const speakers = participants.filter((p) => p.role === "host" || p.canPublish).length;
    if (speakers >= MAX_SPEAKERS) { say("The stage is full. Move someone back to listeners first."); return; }
    if (await control("allow", identity)) setHands((x) => x.filter((y) => y !== identity));
  }, [control, participants, say]);
  const decline = useCallback((identity: string) => {
    setHands((x) => x.filter((y) => y !== identity));
    send("hand", { type: "declined", to: identity }).catch(() => {});
  }, [send]);
  const moveToListeners = useCallback(async (identity: string) => { await control("revoke", identity); }, [control]);
  const mute = useCallback(async (identity: string) => { if (await control("mute", identity)) say("Muted."); }, [control, say]);
  const ban = useCallback(async (identity: string) => {
    const ok = await control("ban", identity);
    if (ok) { setHands((x) => x.filter((y) => y !== identity)); say("Banned from this group."); }
    return ok;
  }, [control, say]);
  const stepDown = useCallback(async () => {
    await stopMic();
    if (await control("revoke", undefined, true)) say("You stepped down. Still listening.");
  }, [control, say, stopMic]);
  const endRoom = useCallback(async () => { if (await control("end")) await teardown(); }, [control, teardown]);
  const enableSound = useCallback(() => { roomRef.current?.startAudio().then(() => setNeedSound(false)).catch(() => {}); }, []);
  const getLevel = useCallback((identity: string) => {
    const r = roomRef.current;
    if (!r) return 0;
    return identity === r.localParticipant.identity ? r.localParticipant.audioLevel : (r.remoteParticipants.get(identity)?.audioLevel ?? 0);
  }, []);
  const stage = useCallback((on: boolean) => setOnStage(on), []);

  // Signing out or hitting Quick exit ends the meeting at once.
  useEffect(() => { if (!session && roomRef.current) teardown(); }, [session, teardown]);
  useEffect(() => {
    const out = () => { if (roomRef.current) teardown(); };
    window.addEventListener("therapia:quickexit", out);
    return () => window.removeEventListener("therapia:quickexit", out);
  }, [teardown]);

  // Tells the phone that audio is playing, which helps it keep going when the screen is off.
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: "Therapia group", artist: "Live meeting" });
    return () => { navigator.mediaSession.metadata = null; };
  }, [active]);

  const barOn = !!active && !onStage;
  useEffect(() => {
    document.body.classList.toggle("has-meetbar", barOn);
    return () => document.body.classList.remove("has-meetbar");
  }, [barOn]);

  const me = participants.find((p) => p.local) ?? null;
  const canSpeak = !!me && (me.role === "host" || me.canPublish);

  const value = useMemo<Meeting>(() => ({
    active, status, error, participants, me, hands, myHand, micBusy, needSound, voice, setVoice, join, leave, enableSound, toggleMic, toggleHand,
    invite, decline, moveToListeners, mute, ban, stepDown, endRoom, getLevel, stage, say,
  }), [active, status, error, participants, me, hands, myHand, micBusy, needSound, voice, setVoice, join, leave, enableSound, toggleMic, toggleHand, invite, decline, moveToListeners, mute, ban, stepDown, endRoom, getLevel, stage, say]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div ref={audioBox} style={{ display: "none" }} aria-hidden="true" />
      {notice && <div className="toast" role="status" aria-live="polite">{notice}</div>}
      {barOn && active && (
        <div className="meetbar" role="region" aria-label="Live meeting">
          <span className="livepill"><i />Live</span>
          <Link className="meetbar-t" href={`/room/${active.roomId}`}>{active.title}</Link>
          {needSound && <button className="btn accent sm" onClick={enableSound}>Turn on sound</button>}
          {canSpeak
            ? <button className={`btn sm ${me?.micOn ? "accent" : "soft"}`} onClick={toggleMic} disabled={micBusy}>{me?.micOn ? "🎙 On" : "🔇 Muted"}</button>
            : <button className={`btn sm ${myHand ? "accent" : "soft"}`} onClick={toggleHand}>{myHand ? "✋ Hand up" : "🔇 Muted"}</button>}
          <button className="btn ghost sm" onClick={leave}>Leave</button>
        </div>
      )}
    </Ctx.Provider>
  );
}
