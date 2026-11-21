"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Track = { id: string; title: string; description: string; duration_secs: number; path: string };
const SLEEP = [0, 15, 30, 45, 60] as const; // minutes; 0 = off
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Meditation and sleep audio player. Sleep timer fades the sound out, then stops. */
export default function AudioTool({ kind }: { kind: "meditation" | "sleep" }) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [cur, setCur] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0), [len, setLen] = useState(0);
  const [loop, setLoop] = useState(kind === "sleep");
  const [timer, setTimer] = useState<number>(kind === "sleep" ? 30 : 0);
  const [left, setLeft] = useState<number | null>(null); // seconds until the sleep timer ends
  const [err, setErr] = useState("");
  const el = useRef<HTMLAudioElement>(null);
  const end = useRef<number | null>(null);

  useEffect(() => {
    supabase().from("audios").select("id,title,description,duration_secs,path").eq("kind", kind).eq("active", true)
      .order("sort").order("created_at", { ascending: false }).then((r) => setTracks((r.data as Track[]) ?? []));
  }, [kind]);

  const url = (t: Track) => supabase().storage.from("audio").getPublicUrl(t.path).data.publicUrl;

  const play = useCallback((t: Track) => {
    const a = el.current; if (!a) return;
    setErr(""); setCur(t); a.volume = 1; a.src = url(t);
    a.play().then(() => {
      setPlaying(true);
      end.current = timer ? Date.now() + timer * 60_000 : null;
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: "Theraping" });
        navigator.mediaSession.setActionHandler("play", () => a.play());
        navigator.mediaSession.setActionHandler("pause", () => a.pause());
      }
    }).catch(() => setErr("This audio couldn't play. Check your connection and try again."));
  }, [timer]);

  // Sleep timer: fade over the last 20 seconds, then stop.
  useEffect(() => {
    const id = setInterval(() => {
      const a = el.current;
      if (!a || !end.current || a.paused) { setLeft(null); return; }
      const s = Math.max(0, Math.round((end.current - Date.now()) / 1000));
      setLeft(s);
      if (s <= 20) a.volume = Math.max(0, s / 20);
      if (s === 0) { a.pause(); a.volume = 1; end.current = null; setLeft(null); }
    }, 500);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (el.current) el.current.loop = loop; }, [loop]);
  useEffect(() => () => { el.current?.pause(); }, []);

  const toggle = () => { const a = el.current; if (!a || !cur) return; if (a.paused) { a.volume = 1; a.play(); } else a.pause(); };

  return (
    <>
      <h1 className="display ptitle">{kind === "sleep" ? "Sleep" : "Meditate"}</h1>
      <p className="muted">{kind === "sleep" ? "Quiet audio to help you wind down. Set a timer and put your phone down." : "Guided audio to slow down and reset. Find a quiet spot and use headphones if you can."}</p>
      <audio ref={el} preload="none"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setLen(e.currentTarget.duration || 0)}
        onEnded={() => { setPlaying(false); end.current = null; }} />
      {tracks === null && <p className="muted">Loading…</p>}
      {tracks && tracks.length === 0 && <p className="empty">Audios are coming soon.</p>}
      <div className="stack">
        {tracks?.map((t) => (
          <article className="card row adm-line" key={t.id} style={{ gap: 12 }}>
            <button className="btn primary sm" aria-label={`Play ${t.title}`} onClick={() => (cur?.id === t.id ? toggle() : play(t))}>{cur?.id === t.id && playing ? "❚❚" : "▶"}</button>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>{t.title}</b>{t.duration_secs ? <span className="fine"> · {Math.max(1, Math.round(t.duration_secs / 60))} min</span> : null}
              {t.description && <><br /><span className="muted">{t.description}</span></>}
            </span>
          </article>
        ))}
      </div>
      {cur && (
        <div className="card stack">
          <span className="fine">{cur.title} · {fmt(pos)}{len ? ` / ${fmt(len)}` : ""}</span>
          <input type="range" aria-label="Position" min={0} max={Math.max(1, len)} step={1} value={Math.min(pos, len || 0)} onChange={(e) => { if (el.current) el.current.currentTime = Number(e.target.value); }} />
        </div>
      )}
      <div className="card stack">
        <span className="eyebrow">Sleep timer</span>
        <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {SLEEP.map((m) => (
            <button key={m} type="button" className={`btn sm ${timer === m ? "primary" : "soft"}`} onClick={() => { setTimer(m); end.current = m && playing ? Date.now() + m * 60_000 : null; if (!m) setLeft(null); }}>{m ? `${m} min` : "Off"}</button>
          ))}
        </span>
        {left !== null && <p className="fine" role="status">Fading out in {fmt(left)}</p>}
        <label className="check"><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />Repeat this audio</label>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
    </>
  );
}
