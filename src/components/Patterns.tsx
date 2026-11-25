"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Entry = { id: string; body: string; created_at: string };
const PAGE = 30;
const when = (iso: string) => new Date(iso).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Patterns, step one: private entries saved to the person's account. Nothing is analysed yet. */
export default function Patterns() {
  const [items, setItems] = useState<Entry[] | null>(null);
  const [more, setMore] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async (from = 0) => {
    const r = await supabase().from("pattern_entries").select("id,body,created_at").order("created_at", { ascending: false }).range(from, from + PAGE);
    if (r.error) { setErr("Couldn't load your entries. Check your connection."); setItems((x) => x ?? []); return; }
    const rows = (r.data ?? []) as Entry[];
    setMore(rows.length > PAGE);
    const page = rows.slice(0, PAGE);
    setItems((x) => (from === 0 ? page : [...(x ?? []), ...page]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setErr("");
    const r = await supabase().from("pattern_entries").insert({ body: text.trim() }).select("id,body,created_at").single();
    setBusy(false);
    if (r.error || !r.data) { setErr("Couldn't save that. Try again."); return; }
    setItems((x) => [r.data as Entry, ...(x ?? [])]); setText("");
  }
  async function save(id: string) {
    if (!draft.trim()) return;
    const r = await supabase().from("pattern_entries").update({ body: draft.trim() }).eq("id", id);
    if (r.error) { setErr("Couldn't save the change."); return; }
    setItems((x) => (x ?? []).map((y) => (y.id === id ? { ...y, body: draft.trim() } : y))); setEditing(null);
  }
  async function del(id: string) {
    if (!window.confirm("Delete this entry? This can't be undone.")) return;
    const r = await supabase().from("pattern_entries").delete().eq("id", id);
    if (r.error) { setErr("Couldn't delete it."); return; }
    setItems((x) => (x ?? []).filter((y) => y.id !== id));
  }

  return (
    <>
      <h1 className="display ptitle">Patterns</h1>
      <p className="muted">Write what&rsquo;s on your mind, whenever you like. No daily target and no streaks. Over time, this is where you&rsquo;ll start to see what keeps coming up.</p>
      <p className="fine">🔒 Saved to your account. Only you can read your entries. Nothing is analysed yet.</p>
      <form className="card stack" onSubmit={add}>
        <label className="stack"><span className="eyebrow">What happened, or how are you feeling?</span>
          <textarea className="field" rows={5} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write freely. It's just for you." /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <span className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <span className="fine">{text.length}/4000</span>
          <button className="btn primary" type="submit" disabled={busy || !text.trim()}>{busy ? "Saving…" : "Save entry"}</button>
        </span>
      </form>

      {items === null && <p className="muted">Loading…</p>}
      {items && items.length === 0 && <p className="empty">No entries yet. Your first one will show here.</p>}
      {items && items.length > 0 && <h2 className="sec-h display">Your entries</h2>}
      <div className="stack">
        {items?.map((x) => (
          <article className="card stack" key={x.id}>
            <span className="fine">{when(x.created_at)}</span>
            {editing === x.id ? (
              <>
                <textarea className="field" rows={5} maxLength={4000} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit entry" />
                <span className="row" style={{ gap: 8 }}>
                  <button className="btn primary sm" onClick={() => save(x.id)}>Save</button>
                  <button className="btn ghost sm" onClick={() => setEditing(null)}>Cancel</button>
                </span>
              </>
            ) : (
              <>
                <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{x.body}</p>
                <span className="row" style={{ gap: 8 }}>
                  <button className="btn soft sm" onClick={() => { setEditing(x.id); setDraft(x.body); }}>Edit</button>
                  <button className="btn ghost sm" onClick={() => del(x.id)}>Delete</button>
                </span>
              </>
            )}
          </article>
        ))}
      </div>
      {more && <button className="btn soft" onClick={() => load(items?.length ?? 0)}>Show older entries</button>}
    </>
  );
}
