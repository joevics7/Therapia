"use client";
import { useEffect, useRef, useState } from "react";
import { startPreview, VOICE_IDS, VOICES, type VoiceId } from "@/lib/voice";

/** Choose how your voice sounds to others. The change happens on your device before audio is sent. */
export function VoicePicker({ value, onChange }: { value: VoiceId; onChange: (v: VoiceId) => void }) {
  return (
    <div className="chips voices" role="group" aria-label="Your voice">
      {VOICE_IDS.map((id) => (
        <button key={id} type="button" className="chip" aria-pressed={value === id} onClick={() => onChange(id)} title={VOICES[id].hint}>{VOICES[id].label}</button>
      ))}
    </div>
  );
}

/** Account-page card with a "hear myself" test. */
export function VoiceSettings({ value, onChange }: { value: VoiceId; onChange: (v: VoiceId) => void }) {
  const [on, setOn] = useState(false);
  const [err, setErr] = useState("");
  const prev = useRef<{ setVoice: (v: VoiceId) => void; stop: () => void } | null>(null);

  useEffect(() => { prev.current?.setVoice(value); }, [value]);
  useEffect(() => () => { prev.current?.stop(); prev.current = null; }, []);

  async function toggle() {
    setErr("");
    if (on) { prev.current?.stop(); prev.current = null; setOn(false); return; }
    try { prev.current = await startPreview(value); setOn(true); }
    catch { setErr("Couldn't reach your microphone. Check your browser's permission."); }
  }

  return (
    <div className="card">
      <h2 className="sec-h display">Your voice</h2>
      <p className="muted">Change how you sound when you speak in a group. It happens on your device, so others only ever hear the changed voice.</p>
      <VoicePicker value={value} onChange={onChange} />
      <p className="fine">{VOICES[value].hint}.</p>
      <button className="btn ghost" type="button" onClick={toggle}>{on ? "Stop listening" : "Hear myself"}</button>
      {on && <p className="notice" role="status">Use headphones, or you may hear an echo.</p>}
      {err && <p className="err" role="alert">{err}</p>}
      <p className="fine">A changed voice is harder to recognise but not impossible. Don&rsquo;t share details that could identify you.</p>
    </div>
  );
}
