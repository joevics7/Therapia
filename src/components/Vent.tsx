"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { avatarVar, initials } from "@/lib/session";
import { HelpSheet, useToast } from "./ui";

type Post = {
  id: number; alias: string; handle: string; anonymous: boolean; kind: "text" | "voice"; body: string | null;
  voice_path: string | null; voice_secs: number | null; just_venting: boolean; quote_id: number | null; created_at: string;
};
type Counts = Record<number, Record<string, { n: number; mine: boolean }>>;
const COLS = "id,alias,handle,anonymous,kind,body,voice_path,voice_secs,just_venting,quote_id,created_at";
export const REACTIONS = ["❤️", "🙏", "🤗", "😂", "💪", "😢"];
const BLOCKED = /(\+?\d[\d\s\-]{6,}\d)|https?:\/\/|www\./i;
const MAX_SECS = 60;

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

async function token() {
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? "";
}

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function VoicePlayer({ path, secs }: { path: string; secs: number | null }) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  async function load() {
    setState("loading");
    try {
      const r = await fetch(`/api/vent/voice?path=${encodeURIComponent(path)}`, { headers: { Authorization: `Bearer ${await token()}` } });
      const d = await r.json();
      if (!r.ok || !d.url) { setState("error"); return; }
      setUrl(d.url); setState("idle");
    } catch { setState("error"); }
  }
  if (url) return <audio className="vent-audio" controls autoPlay src={url} aria-label="Voice note" />;
  return (
    <button type="button" className="btn soft sm" onClick={load} disabled={state === "loading"}>
      {state === "loading" ? "Loading…" : state === "error" ? "Couldn't load. Try again" : `▶ Play voice note${secs ? ` (${secs}s)` : ""}`}
    </button>
  );
}

/** A place to let it out. Text or a short voice note, shared with the group. Hidden username by default. */
export default function Vent({ roomId, alias, isHost }: { roomId: string; alias: string; isHost: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [mine, setMine] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [showName, setShowName] = useState(false);
  const [just, setJust] = useState(false);
  const [quote, setQuote] = useState<Post | null>(null);
  const [busy, setBusy] = useState(false);
  const [care, setCare] = useState(false); // the private "we're here" card
  const [help, setHelp] = useState(false);
  const [rec, setRec] = useState<{ on: boolean; secs: number }>({ on: false, secs: 0 });
  const [clip, setClip] = useState<{ blob: Blob; secs: number; url: string } | null>(null);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const { say, toast } = useToast();
  const canRecord = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const loadCounts = useCallback(async () => {
    const { data } = await supabase().rpc("vent_reactions_for", { p_room: roomId });
    const c: Counts = {};
    for (const r of (data ?? []) as { post_id: number; emoji: string; n: number; mine: boolean }[]) (c[r.post_id] ??= {})[r.emoji] = { n: Number(r.n), mine: r.mine };
    setCounts(c);
  }, [roomId]);

  const reload = useCallback(async () => {
    const { data } = await supabase().from("vent_posts").select(COLS).eq("room_id", roomId).order("id", { ascending: false }).limit(100);
    setPosts(((data ?? []) as Post[]));
    const own = await supabase().rpc("my_vent_ids", { p_room: roomId });
    if (Array.isArray(own.data)) setMine(new Set(own.data as number[]));
    setLoaded(true);
    loadCounts();
  }, [roomId, loadCounts]);

  useEffect(() => {
    reload();
    const sb = supabase();
    const ch = sb.channel(`vent:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "vent_posts", filter: `room_id=eq.${roomId}` }, (p) => {
        setPosts((cur) => (cur.some((x) => x.id === (p.new as Post).id) ? cur : [p.new as Post, ...cur]));
      })
      .subscribe();
    const t = setInterval(reload, 30_000);
    return () => { clearInterval(t); sb.removeChannel(ch); };
  }, [roomId, reload]);

  useEffect(() => () => { clearInterval(timer.current); mr.current?.stream.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.url); }, [clip]);

  function afterPost(d: { id: number; crisis?: boolean } & Post) {
    setPosts((cur) => (cur.some((x) => x.id === d.id) ? cur : [d, ...cur]));
    setMine((s) => new Set(s).add(d.id));
    if (d.crisis) setCare(true);
  }
  function failMsg(e: { message?: string; code?: string } | null) {
    const m = e?.message ?? "";
    if (m.includes("slow_down")) return "Slow down a little.";
    if (e?.code === "23514") return "Phone numbers and links aren't allowed.";
    if (m.includes("no_quote")) return "That post is Just venting, so it can only get reactions.";
    if (m.includes("quote_gone")) return "The post you're replying to was removed.";
    return "Couldn't post. Try again.";
  }

  async function postText(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    if (BLOCKED.test(body)) { say("Phone numbers and links aren't allowed. It keeps everyone safe."); return; }
    setBusy(true);
    const { data, error } = await supabase().rpc("post_vent", { p_room: roomId, p_kind: "text", p_body: body, p_anonymous: !showName, p_just: just, p_quote: quote?.id ?? null, p_voice_path: null, p_voice_secs: null });
    setBusy(false);
    if (error || !data) { say(failMsg(error)); return; }
    setText(""); setQuote(null); setJust(false);
    afterPost(data as never);
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const r = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 });
      chunks.current = [];
      let secs = 0;
      r.ondataavailable = (ev) => { if (ev.data.size) chunks.current.push(ev.data); };
      r.onstop = () => {
        clearInterval(timer.current);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: (r.mimeType || mime || "audio/webm").split(";")[0] });
        setRec({ on: false, secs: 0 });
        if (blob.size < 800 || secs < 1) { say("That was too short. Try again."); return; }
        setClip({ blob, secs: Math.min(MAX_SECS, Math.max(1, secs)), url: URL.createObjectURL(blob) });
      };
      mr.current = r;
      r.start();
      setRec({ on: true, secs: 0 });
      timer.current = setInterval(() => {
        secs += 1;
        setRec({ on: true, secs });
        if (secs >= MAX_SECS) r.stop();
      }, 1000);
    } catch { say("Couldn't reach your microphone. Check your browser's permission."); }
  }
  const stopRec = () => { if (mr.current && mr.current.state !== "inactive") mr.current.stop(); };

  async function sendClip() {
    if (!clip || busy) return;
    setBusy(true);
    try {
      const up = await fetch(`/api/vent/voice?room=${encodeURIComponent(roomId)}`, { method: "POST", headers: { "Content-Type": clip.blob.type, Authorization: `Bearer ${await token()}` }, body: clip.blob });
      const u = await up.json().catch(() => ({}));
      if (!up.ok || !u.path) { say(u.error ?? "Couldn't send your voice note. Try again."); return; }
      const { data, error } = await supabase().rpc("post_vent", { p_room: roomId, p_kind: "voice", p_body: null, p_anonymous: !showName, p_just: just, p_quote: quote?.id ?? null, p_voice_path: u.path, p_voice_secs: clip.secs });
      if (error || !data) { say(failMsg(error)); return; }
      setClip(null); setQuote(null); setJust(false);
      afterPost(data as never);
    } catch { say("No connection. Try again."); }
    finally { setBusy(false); }
  }

  async function react(p: Post, emoji: string) {
    const was = counts[p.id]?.[emoji]?.mine ?? false;
    setCounts((c) => {
      const cur = c[p.id]?.[emoji] ?? { n: 0, mine: false };
      return { ...c, [p.id]: { ...c[p.id], [emoji]: { n: Math.max(0, cur.n + (was ? -1 : 1)), mine: !was } } };
    });
    const { error } = await supabase().rpc("react_vent", { p_post: p.id, p_emoji: emoji });
    if (error) { say("Couldn't react. Try again."); loadCounts(); }
  }

  async function report(p: Post) {
    const { error } = await supabase().rpc("report_vent", { p_post: p.id, p_reason: "" });
    say(error ? "Couldn't send the report. Try again." : "Reported. The host will review it.");
  }

  async function remove(p: Post) {
    const { error } = await supabase().rpc("delete_vent", { p_id: p.id });
    if (error) { say("Couldn't delete that."); return; }
    setPosts((c) => c.filter((x) => x.id !== p.id));
  }

  const byId = new Map(posts.map((p) => [p.id, p]));

  return (
    <div className="vent">
      {toast}
      {help && <HelpSheet onClose={() => setHelp(false)} />}
      {care && (
        <div className="card carecard" role="status">
          <p className="display" style={{ fontSize: 18, margin: 0 }}>You don&rsquo;t have to carry this alone.</p>
          <p className="muted">Only you can see this message. If you might hurt yourself or you are in danger, please reach someone now. In an emergency call 112. The group host has also been told that someone may need a check-in.</p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="btn accent" onClick={() => setHelp(true)}>Get help now</button>
            <button className="btn ghost" onClick={() => setCare(false)}>Close</button>
          </div>
        </div>
      )}

      <form className="card ventform" onSubmit={postText}>
        <p className="muted" style={{ margin: 0 }}>Let it out. Write it or say it. This is for you, not for fixing.</p>
        {quote && (
          <div className="quote-bar">
            <span>Replying to: {quote.kind === "voice" ? "a voice note" : (quote.body ?? "").slice(0, 80)}</span>
            <button type="button" aria-label="Cancel reply" onClick={() => setQuote(null)}>✕</button>
          </div>
        )}
        {clip ? (
          <div className="stack">
            <audio className="vent-audio" controls src={clip.url} aria-label="Your recording" />
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn primary" disabled={busy} onClick={sendClip}>{busy ? "Sending…" : "Post voice note"}</button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => setClip(null)}>Discard</button>
            </div>
          </div>
        ) : rec.on ? (
          <div className="row recording" role="status">
            <span className="recdot" aria-hidden="true" />Recording {rec.secs}s of {MAX_SECS}s
            <button type="button" className="btn accent sm" onClick={stopRec}>Stop</button>
          </div>
        ) : (
          <>
            <textarea className="field" rows={3} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="What's on your heart?" aria-label="What's on your heart?" />
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn primary" type="submit" disabled={busy || !text.trim()}>{busy ? "Posting…" : "Post"}</button>
              {canRecord && <button type="button" className="btn soft" onClick={startRec}>🎙 Voice note</button>}
            </div>
          </>
        )}
        <div className="vent-opts">
          <label className="check"><input type="checkbox" checked={just} onChange={(e) => setJust(e.target.checked)} />Just venting <span className="fine">(only reactions, no replies)</span></label>
          <label className="check"><input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />Show my username</label>
        </div>
        <p className="fine">Your username is hidden unless you choose to show it. Voice notes are saved for 30 days, then deleted, and a voice can sometimes be recognised. If a post sounds like someone may be in danger, the host is alerted and can see who wrote it. Phone numbers and links are blocked.</p>
      </form>

      <div className="vent-list" role="log" aria-live="polite">
        {loaded && posts.length === 0 && <p className="empty">Nothing here yet. Whenever you&rsquo;re overwhelmed, this is a safe place to say it.</p>}
        {posts.map((p) => {
          const own = mine.has(p.id) || p.alias === alias;
          const q = p.quote_id ? byId.get(p.quote_id) : undefined;
          const rc = counts[p.id] ?? {};
          return (
            <article className="card ventpost" key={p.id}>
              <div className="row vp-head">
                <span className="av" style={{ "--s": "28px", background: p.anonymous ? "var(--muted)" : avatarVar(p.handle) } as React.CSSProperties} aria-hidden="true">{p.anonymous ? "?" : initials(p.handle)}</span>
                <b>{own ? (p.anonymous ? "You (username hidden)" : "You") : p.handle}</b>
                <span className="fine">{ago(p.created_at)}</span>
                {p.just_venting && <span className="badge">Just venting</span>}
              </div>
              {p.quote_id && <blockquote className="quoted">{q ? (q.kind === "voice" ? "🎙 Voice note" : (q.body ?? "").slice(0, 140)) : "Original post removed"}</blockquote>}
              {p.kind === "text" ? <p className="vp-body">{p.body}</p> : p.voice_path && <VoicePlayer path={p.voice_path} secs={p.voice_secs} />}
              <div className="reactions" role="group" aria-label="Reactions">
                {REACTIONS.map((e) => {
                  const r = rc[e];
                  return <button key={e} type="button" className="rx" aria-pressed={!!r?.mine} aria-label={`React ${e}`} onClick={() => react(p, e)}>{e}{r && r.n > 0 && <span>{r.n}</span>}</button>;
                })}
              </div>
              <div className="msg-acts">
                {!p.just_venting && <button onClick={() => { setQuote(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Reply</button>}
                {!own && <button onClick={() => report(p)}>Report</button>}
                {(own || isHost) && <button onClick={() => remove(p)}>Delete</button>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
