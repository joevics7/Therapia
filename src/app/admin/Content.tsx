"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import NeedsPicker from "@/components/NeedsPicker";
import { needLabel } from "@/lib/needs";

type Call = (action: string, body?: object) => Promise<{ ok: boolean; data: Record<string, unknown> }>;
type Say = (m: string) => void;

type Msg = { id: string; body: string; active: boolean; topics: string[]; created_at: string };

/** Morning messages: one shows per day on the dashboard (cycling through the active ones) and goes out as the morning notification. */
export function Motivation({ call, say }: { call: Call; say: Say }) {
  const [items, setItems] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const load = useCallback(async () => { setItems(((await call("motivations.list")).data.items as Msg[]) ?? []); }, [call]);
  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await call("motivation.save", { id: editing ?? undefined, body: text, topics });
    if (!r.ok) { say(String(r.data.error ?? "Couldn't save.")); return; }
    setText(""); setTopics([]); setEditing(null); say("Saved."); load();
  }
  async function toggle(m: Msg) { await call("motivation.save", { id: m.id, body: m.body, active: !m.active, topics: m.topics }); load(); }
  async function del(m: Msg) {
    if (!window.confirm("Delete this message?")) return;
    const r = await call("motivation.delete", { id: m.id });
    say(r.ok ? "Deleted." : String(r.data.error ?? "Couldn't delete."));
    load();
  }

  return (
    <section className="stack">
      <h1 className="display ptitle" style={{ fontSize: 24, margin: 0 }}>Morning messages</h1>
      <p className="muted">Each person gets one message a day, chosen from the messages for everyone plus the ones tagged with the topics they picked at sign-up. It shows in Tools and goes out as the morning notification at the time they chose.</p>
      <form className="card stack" onSubmit={save}>
        <label className="stack"><span className="eyebrow">{editing ? "Edit message" : "New message"} (max 400 characters)</span>
          <textarea className="field" rows={3} maxLength={400} required value={text} onChange={(e) => setText(e.target.value)} placeholder="Today you only need to take the next small step." /></label>
        <div className="stack"><span className="eyebrow">Who gets it (leave all off for everyone)</span><NeedsPicker value={topics} onChange={setTopics} /></div>
        <span className="row" style={{ gap: 8 }}>
          <button className="btn primary sm" type="submit">{editing ? "Save changes" : "Add message"}</button>
          {editing && <button type="button" className="btn ghost sm" onClick={() => { setEditing(null); setText(""); setTopics([]); }}>Cancel</button>}
        </span>
      </form>
      {items === null && <p className="muted">Loading…</p>}
      {items && items.length === 0 && <p className="muted">No messages yet. Without any, no morning notification is sent.</p>}
      {items?.map((m) => (
        <article className="card row adm-line" key={m.id} style={{ flexWrap: "wrap", gap: 8 }}>
          <span style={{ flex: "1 1 240px", minWidth: 0 }}>{m.body} <span className="badge">{m.active ? "Active" : "Off"}</span> <span className="fine">{m.topics.length ? m.topics.map(needLabel).join(", ") : "Everyone"}</span></span>
          <span className="row" style={{ gap: 6 }}>
            <button className="btn soft sm" onClick={() => { setEditing(m.id); setText(m.body); setTopics(m.topics ?? []); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
            <button className="btn soft sm" onClick={() => toggle(m)}>{m.active ? "Turn off" : "Turn on"}</button>
            <button className="btn ghost sm" onClick={() => del(m)}>Delete</button>
          </span>
        </article>
      ))}
    </section>
  );
}

type Audio = { id: string; kind: "meditation" | "sleep"; title: string; description: string; duration_secs: number; path: string; active: boolean; sort: number };
const mins = (s: number) => (s ? `${Math.max(1, Math.round(s / 60))} min` : "");

function fileDuration(f: File): Promise<number> {
  return new Promise((res) => {
    const a = new Audio(), url = URL.createObjectURL(f);
    const done = (n: number) => { URL.revokeObjectURL(url); res(n); };
    a.preload = "metadata"; a.src = url;
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? Math.round(a.duration) : 0);
    a.onerror = () => done(0);
  });
}

/** Meditation and sleep audios. The file goes from the browser straight to storage (Vercel can't take large uploads). */
export function Audios({ call, say }: { call: Call; say: Say }) {
  const [items, setItems] = useState<Audio[] | null>(null);
  const [kind, setKind] = useState<"meditation" | "sleep">("meditation");
  const [title, setTitle] = useState(""), [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { setItems(((await call("audios.list")).data.items as Audio[]) ?? []); }, [call]);
  useEffect(() => { load(); }, [load]);

  async function upload(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const f = file.current?.files?.[0];
    if (!f) { setErr("Choose an audio file."); return; }
    if (f.size > 50 * 1024 * 1024) { setErr("The file is over 50 MB. Compress it (for example mp3 at 64–96 kbps) and try again."); return; }
    const ext = (f.name.split(".").pop() ?? "").toLowerCase();
    setBusy(true);
    const u = await call("audio.upload_url", { kind, ext });
    if (!u.ok) { setBusy(false); setErr(String(u.data.error ?? "Couldn't prepare the upload.")); return; }
    const path = String(u.data.path);
    const up = await supabase().storage.from("audio").uploadToSignedUrl(path, String(u.data.token), f, { contentType: f.type || undefined });
    if (up.error) { setBusy(false); setErr("The upload failed. Check the file type and size, then try again."); return; }
    const s = await call("audio.save", { kind, title, description: desc, path, duration_secs: await fileDuration(f) });
    setBusy(false);
    if (!s.ok) { setErr(String(s.data.error ?? "Couldn't save.")); return; }
    setTitle(""); setDesc(""); if (file.current) file.current.value = "";
    say("Uploaded."); load();
  }
  async function toggle(a: Audio) { await call("audio.save", { ...a, active: !a.active }); load(); }
  async function del(a: Audio) {
    if (!window.confirm(`Delete "${a.title}" and its file?`)) return;
    const r = await call("audio.delete", { id: a.id });
    say(r.ok ? "Deleted." : String(r.data.error ?? "Couldn't delete."));
    load();
  }

  return (
    <section className="stack">
      <h1 className="display ptitle" style={{ fontSize: 24, margin: 0 }}>Meditation and sleep audio</h1>
      <form className="card stack" onSubmit={upload}>
        <label className="stack"><span className="eyebrow">Type</span>
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value as "meditation" | "sleep")}><option value="meditation">Meditation</option><option value="sleep">Sleep</option></select></label>
        <label className="stack"><span className="eyebrow">Title *</span><input className="field" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="stack"><span className="eyebrow">Short description</span><input className="field" maxLength={400} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
        <label className="stack"><span className="eyebrow">Audio file (mp3, m4a, aac, ogg, wav; up to 50 MB) *</span><input ref={file} type="file" accept="audio/*" /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>
      </form>
      {items === null && <p className="muted">Loading…</p>}
      {items && items.length === 0 && <p className="muted">Nothing uploaded yet.</p>}
      {items?.map((a) => (
        <article className="card stack" key={a.id}>
          <span className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span><b>{a.title}</b> <span className="badge">{a.kind}</span> <span className="badge">{a.active ? "Shown" : "Hidden"}</span> <span className="fine">{mins(a.duration_secs)}</span></span>
            <span className="row" style={{ gap: 6 }}>
              <button className="btn soft sm" onClick={() => toggle(a)}>{a.active ? "Hide" : "Show"}</button>
              <button className="btn ghost sm" onClick={() => del(a)}>Delete</button>
            </span>
          </span>
          <audio controls preload="none" style={{ width: "100%" }} src={supabase().storage.from("audio").getPublicUrl(a.path).data.publicUrl} />
        </article>
      ))}
    </section>
  );
}
