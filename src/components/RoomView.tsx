"use client";

import { useEffect, useState } from "react";
import { VoicePicker } from "./VoicePicker";
import { VOICES } from "@/lib/voice";
import { type RoomDef } from "@/lib/rooms";
import { avatarVar, initials } from "@/lib/session";
import { type PInfo, useMeeting } from "./MeetingProvider";
import { Sheet } from "./ui";
import { MAX_SPEAKERS } from "@/lib/rooms";

const Avatar = ({ name, size }: { name: string; size: number }) => (
  <span className="av" style={{ "--s": `${size}px`, background: avatarVar(name) } as React.CSSProperties} aria-hidden="true">{initials(name)}</span>
);

/** A small live bar that moves with the person's voice, so you can see the microphone is working. */
function Level({ id }: { id: string }) {
  const { getLevel } = useMeeting();
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setV(getLevel(id)), 120);
    return () => clearInterval(t);
  }, [id, getLevel]);
  return <div className="level" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.round(v * 160))}%` }} /></div>;
}

/**
 * The live meeting, laid out like an audio space: speakers on top, everyone else listed below as listeners,
 * and one big button at the bottom that shows whether you are muted and lets you ask to speak.
 * The connection itself lives in MeetingProvider, so leaving this screen does not end it.
 */
export default function RoomView({ host, onLeave }: { room: RoomDef; host: boolean; onLeave?: () => void }) {
  const m = useMeeting();
  const { participants, me, hands } = m;
  const speakers = participants.filter((p) => p.role === "host" || p.canPublish);
  const hostP = speakers.find((p) => p.role === "host");
  const guests = speakers.filter((p) => p.role !== "host");
  const listeners = participants.filter((p) => !speakers.includes(p));
  const handSet = new Set(hands);
  const sortedListeners = [...listeners].sort((a, b) => Number(handSet.has(b.identity)) - Number(handSet.has(a.identity)));
  const canSpeak = !!me && (me.role === "host" || me.canPublish);
  const micOn = !!me?.micOn;
  const nameOf = (p: PInfo) => (p.local ? "You" : p.name);
  const [pick, setPick] = useState<string | null>(null);
  const picked = pick ? participants.find((p) => p.identity === pick) ?? null : null;
  const stageFull = speakers.length >= MAX_SPEAKERS;
  const canPick = (p: PInfo) => host && !p.local && p.role !== "host";

  return (
    <div className="room meet">
      {m.needSound && <button className="btn accent big" onClick={m.enableSound}>Tap to turn on sound</button>}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <span className="livepill"><i />{hostP ? "Live now" : "Host is joining…"}</span>
        <button className="btn ghost sm" onClick={onLeave ?? m.leave}>Leave quietly</button>
      </div>
      <p className="fine">You can use the rest of the app while you listen. A bar at the top keeps you in the meeting.</p>

      {host && (
        <div className="hostbar">
          <span className="eyebrow">Host tools</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn soft sm" onClick={m.endRoom}>End room for everyone</button>
            {hands.length > 0 && <span className="badge">✋ {hands.length} hand{hands.length === 1 ? "" : "s"} up</span>}
          </div>
        </div>
      )}

      <section className="stage" aria-label="Speakers">
        <div className="eyebrow">Speakers</div>
        {hostP ? (
          <div className={`member host${hostP.speaking ? " speaking" : ""}`}>
            <Avatar name={hostP.name} size={64} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="nm">{nameOf(hostP)}</span>
              <div className="fine">Host · facilitator {hostP.micOn ? "· 🎙 mic on" : "· 🔇 muted"}{hostP.speaking ? " · speaking" : ""}</div>
              <Level id={hostP.identity} />
            </div>
          </div>
        ) : (
          <p className="muted">Waiting for the host to arrive.</p>
        )}
        {(guests.length > 0 || host) && (
          <div className="guests">
            {guests.map((g) => (
              <div className={`member${g.speaking ? " speaking" : ""}`} key={g.identity}>
                <Avatar name={g.name} size={52} />
                <span className="nm">{nameOf(g)}</span>
                <span className="fine">{g.micOn ? "🎙 on" : "🔇 muted"}</span>
                <Level id={g.identity} />
                {canPick(g) && <button className="btn soft sm" onClick={() => setPick(g.identity)}>Manage</button>}
              </div>
            ))}
            {host && guests.length === 0 && <p className="fine" style={{ gridColumn: "1 / -1" }}>Nobody else is speaking. Tap a listener below to let them speak.</p>}
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
                {canPick(p) ? (
                  <button type="button" className="ltap" onClick={() => setPick(p.identity)} aria-label={`Manage ${p.name}`}>
                    <span className="lav"><Avatar name={p.name} size={44} />{hand && <span className="handbadge" aria-label="Hand raised">✋</span>}</span>
                    <span className="nm">{nameOf(p)}</span>
                  </button>
                ) : (
                  <>
                    <span className="lav"><Avatar name={p.name} size={44} />{hand && <span className="handbadge" aria-label="Hand raised">✋</span>}</span>
                    <span className="nm">{nameOf(p)}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {host && picked && canPick(picked) && (
        <Sheet onClose={() => setPick(null)}>
          <h3 className="display">{picked.name}</h3>
          <p className="fine">{picked.canPublish ? `Speaking now · ${picked.micOn ? "mic on" : "muted"}` : handSet.has(picked.identity) ? "✋ Has a hand raised" : "Listening"}</p>
          {!picked.canPublish && (
            <>
              <button className="btn primary" disabled={stageFull} onClick={async () => { await m.invite(picked.identity); setPick(null); }}>Let them speak</button>
              {stageFull && <p className="fine">The stage is full (the host and up to {MAX_SPEAKERS - 1} speakers). Move someone back to listeners first.</p>}
              {handSet.has(picked.identity) && <button className="btn soft" onClick={() => { m.decline(picked.identity); setPick(null); }}>Not now (lower their hand)</button>}
            </>
          )}
          {picked.canPublish && (
            <>
              {picked.micOn && <button className="btn soft" onClick={async () => { await m.mute(picked.identity); setPick(null); }}>Mute them</button>}
              <button className="btn soft" onClick={async () => { await m.moveToListeners(picked.identity); setPick(null); }}>Move to listeners</button>
            </>
          )}
          <button className="btn ghost" onClick={async () => { if (window.confirm(`Ban ${picked.name} from this group? They will be removed now and can't rejoin.`)) { if (await m.ban(picked.identity)) setPick(null); } }}>Ban from group</button>
          <button className="btn ghost" onClick={() => setPick(null)}>Close</button>
        </Sheet>
      )}

      <div className="dock">
        {canSpeak ? (
          <>
            <div className="microw">
              <button className={`btn big ${micOn ? "accent" : "soft"}`} onClick={m.toggleMic} disabled={m.micBusy}>{m.micBusy ? "Starting…" : micOn ? "🎙 Mic is ON · tap to mute" : "🔇 Mic is OFF · tap to turn on"}</button>
              {micOn && me && <Level id={me.identity} />}
            </div>
            {!host && <button className="btn ghost" onClick={m.stepDown}>Step down to listen</button>}
          </>
        ) : (
          <button className={`btn big mutedbtn${m.myHand ? " up" : ""}`} onClick={m.toggleHand} aria-pressed={m.myHand}>
            {m.myHand ? <>✋ Hand raised<small>Waiting for the host. Tap to lower your hand.</small></> : <>🔇 You&rsquo;re muted<small>Tap to ask the host to let you speak</small></>}
          </button>
        )}
        <details className="voicebox">
          <summary>Change how my voice sounds</summary>
          <VoicePicker value={m.voice} onChange={m.setVoice} />
          <p className="fine">{VOICES[m.voice].hint}. Others only ever hear the changed voice. Use headphones to avoid echo.</p>
        </details>
      </div>
    </div>
  );
}
