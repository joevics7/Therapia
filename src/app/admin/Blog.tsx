"use client";

import { useCallback, useEffect, useState } from "react";

type Call = (action: string, body?: object) => Promise<{ ok: boolean; data: Record<string, unknown> }>;
type Say = (m: string) => void;
type Item = { id: string; content: string; status: "not_processed" | "processed"; error: string | null; attempts: number; article_slug: string | null; created_at: string };
type Row = { slug: string; category_slug: string; published: boolean; published_at: string | null; article_translations: { title: string; locale: string }[] };

// Same fields and the same AI auto-fill behaviour as the Toolbase admin's article form.
type Values = {
  slug: string; category_slug: string; related_tool_slugs: string; countries: string; published: boolean; locale: string;
  title: string; excerpt: string; content: string; meta_description: string; og_image_url: string; reading_time_minutes: number;
};
const EMPTY: Values = {
  slug: "", category_slug: "", related_tool_slugs: "", countries: "nigeria", published: false, locale: "en",
  title: "", excerpt: "", content: "", meta_description: "", og_image_url: "", reading_time_minutes: 5,
};

export function Blog({ call, say }: { call: Call; say: Say }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [form, setForm] = useState<{ values: Values; lock: boolean } | null>(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const r = await call("articles.list");
    setRows((r.data.articles as Row[]) ?? []);
  }, [call]);
  useEffect(() => { load(); }, [load]);

  async function edit(slug: string) {
    const r = await call("article.get", { slug, locale: "en" });
    if (!r.ok) { say(String(r.data.error ?? "Couldn't open it.")); return; }
    const a = r.data.article as { slug: string; category_slug: string; related_tool_slugs: string[]; countries: string[]; published: boolean };
    const t = (r.data.translation ?? {}) as Partial<{ locale: string; title: string; excerpt: string; content: string; meta_description: string; og_image_url: string; reading_time_minutes: number }>;
    setForm({
      lock: true,
      values: {
        slug: a.slug, category_slug: a.category_slug, related_tool_slugs: (a.related_tool_slugs ?? []).join(", "), countries: (a.countries ?? []).join(", "), published: a.published,
        locale: t.locale ?? "en", title: t.title ?? "", excerpt: t.excerpt ?? "", content: t.content ?? "", meta_description: t.meta_description ?? "",
        og_image_url: t.og_image_url ?? "", reading_time_minutes: t.reading_time_minutes ?? 5,
      },
    });
  }
  async function rewrite(slug: string) {
    setBusy(slug);
    const r = await call("article.rewrite", { slug, locale: "en" });
    setBusy("");
    say(r.ok ? "Rewritten and saved." : `Rewrite failed: ${String(r.data.error ?? "")}`);
    load();
  }
  async function del(slug: string) {
    if (!window.confirm(`Delete "${slug}"? This cannot be undone.`)) return;
    const r = await call("article.delete", { slug });
    say(r.ok ? "Deleted." : String(r.data.error ?? "Couldn't delete."));
    load();
  }

  if (form) return <ArticleForm start={form.values} lock={form.lock} call={call} say={say} onClose={() => { setForm(null); load(); }} />;
  return (
    <section className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 className="display ptitle" style={{ fontSize: 24, margin: 0 }}>Blog articles</h1>
        <button className="btn accent sm" onClick={() => setForm({ values: EMPTY, lock: false })}>+ New article</button>
      </div>
      {rows === null && <p className="muted">Loading…</p>}
      {rows && rows.length === 0 && <p className="muted">No articles yet.</p>}
      <div className="stack">
        {rows?.map((a) => {
          const en = a.article_translations?.find((t) => t.locale === "en");
          return (
            <article className="card row adm-line" key={a.slug} style={{ flexWrap: "wrap", gap: 8 }}>
              <span style={{ flex: "1 1 220px", minWidth: 0 }}>
                <b>{en?.title ?? a.slug}</b> <span className="badge">{a.published ? "Published" : "Draft"}</span>
                <br /><span className="fine">{a.category_slug} · /blog/{a.slug}</span>
              </span>
              <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <button className="btn soft sm" onClick={() => edit(a.slug)}>Edit</button>
                <button className="btn soft sm" disabled={busy === a.slug} onClick={() => rewrite(a.slug)}>{busy === a.slug ? "Rewriting…" : "Rewrite"}</button>
                <button className="btn ghost sm" onClick={() => del(a.slug)}>Delete</button>
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ArticleForm({ start, lock, call, say, onClose }: { start: Values; lock: boolean; call: Call; say: Say; onClose: () => void }) {
  const [v, setV] = useState<Values>(start);
  const [busy, setBusy] = useState<null | "ai" | "save">(null);
  const [err, setErr] = useState("");
  const set = <K extends keyof Values>(k: K, x: Values[K]) => setV((p) => ({ ...p, [k]: x }));
  const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const [saved, setSaved] = useState<Item[] | null>(null);
  const [draft, setDraft] = useState("");
  const loadSaved = useCallback(async () => {
    const r = await call("inbox.list");
    setSaved((r.data.items as Item[]) ?? []);
  }, [call]);
  useEffect(() => { if (!lock) loadSaved(); }, [lock, loadSaved]);
  async function keep() {
    if (!draft.trim()) { setErr("Paste some content to save first."); return; }
    setErr("");
    const r = await call("inbox.add", { content: draft });
    if (!r.ok) { setErr(String(r.data.error ?? "Couldn't save.")); return; }
    setDraft(""); say("Saved for the hourly parser."); loadSaved();
  }
  async function removeSaved(id: string) {
    if (!window.confirm("Delete this saved content?")) return;
    const r = await call("inbox.delete", { id });
    say(r.ok ? "Deleted." : String(r.data.error ?? "Couldn't delete."));
    loadSaved();
  }

  async function aiFill() {
    setErr("");
    if (!v.content.trim()) { setErr("Paste content first."); return; }
    setBusy("ai");
    const r = await call("article.extract", { title: v.title, content: v.content });
    setBusy(null);
    if (!r.ok) { setErr(String(r.data.error ?? "The AI could not finish.")); return; }
    const out = r.data.result as { slug: string; category_slug: string; title: string; related_tool_slugs: string[]; countries: string[]; excerpt: string; meta_description: string; reading_time_minutes: number; cleaned_content: string };
    setV((p) => ({
      ...p,
      slug: lock ? p.slug : p.slug || out.slug,
      category_slug: p.category_slug || out.category_slug,
      title: p.title || out.title,
      related_tool_slugs: p.related_tool_slugs || (out.related_tool_slugs ?? []).join(", "),
      countries: p.countries && p.countries !== "nigeria" ? p.countries : (out.countries ?? ["nigeria"]).join(", "),
      excerpt: out.excerpt,
      meta_description: out.meta_description,
      reading_time_minutes: out.reading_time_minutes,
      content: out.cleaned_content || p.content,
    }));
    say("AI filled fields and cleaned content.");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy("save");
    const r = await call("article.save", { ...v, related_tool_slugs: list(v.related_tool_slugs), countries: list(v.countries) });
    setBusy(null);
    if (!r.ok) { setErr(String(r.data.error ?? "Couldn't save.")); return; }
    say(`Saved: ${String(r.data.slug)}`);
  }

  return (
    <form className="stack" onSubmit={save}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 className="display ptitle" style={{ fontSize: 24, margin: 0 }}>{lock ? "Edit article" : "New article"}</h1>
        <button type="button" className="btn ghost sm" onClick={onClose}>← All articles</button>
      </div>
      <div className="card stack">
        <label className="stack"><span className="eyebrow">Slug *</span><input className="field" required disabled={lock} value={v.slug} onChange={(e) => set("slug", e.target.value)} placeholder="how-to-calm-down-when-overwhelmed" /></label>
        <label className="stack"><span className="eyebrow">Category slug *</span><input className="field" required value={v.category_slug} onChange={(e) => set("category_slug", e.target.value)} placeholder="anxiety" /></label>
        <label className="stack"><span className="eyebrow">Related tool slugs (comma-separated)</span><input className="field" value={v.related_tool_slugs} onChange={(e) => set("related_tool_slugs", e.target.value)} /></label>
        <label className="stack"><span className="eyebrow">Countries (comma-separated)</span><input className="field" value={v.countries} onChange={(e) => set("countries", e.target.value)} /></label>
        <label className="stack"><span className="eyebrow">Locale</span><input className="field" value={v.locale} onChange={(e) => set("locale", e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={v.published} onChange={(e) => set("published", e.target.checked)} />Published</label>
        <label className="stack"><span className="eyebrow">Title *</span><input className="field" required value={v.title} onChange={(e) => set("title", e.target.value)} /></label>
        <label className="stack"><span className="eyebrow">Content (markdown) *</span><textarea className="field" style={{ minHeight: 300, fontFamily: "monospace" }} required value={v.content} onChange={(e) => set("content", e.target.value)} placeholder={"## Heading\n\nBody..."} /></label>
      </div>

      {!lock && (
        <div className="card stack" style={{ borderStyle: "dashed" }}>
          <b>Save content for later</b>
          <p className="muted">Paste raw content here and save it. An hourly job parses the oldest unprocessed one and saves it as a draft. Or press Paste on a saved one to move it into the Content box above.</p>
          <textarea className="field" rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Paste raw content to queue…" />
          <button type="button" className="btn soft" onClick={keep}>Save for later</button>
          {saved && saved.length === 0 && <p className="fine">Nothing saved yet.</p>}
          {saved?.map((it) => (
            <div className="row adm-line" key={it.id} style={{ flexWrap: "wrap", gap: 8 }}>
              <span style={{ flex: "1 1 220px", minWidth: 0 }}>
                <span className="badge">{it.status === "processed" ? "Processed" : "Not processed"}</span>{" "}
                <span className="fine">{new Date(it.created_at).toLocaleString()}{it.article_slug ? ` · /blog/${it.article_slug}` : ""}</span>
                <br /><span className="muted">{it.content.replace(/\s+/g, " ").slice(0, 140)}{it.content.length > 140 ? "…" : ""}</span>
                {it.error && it.status !== "processed" && <><br /><span className="err">Last error: {it.error}{it.attempts >= 3 ? " (gave up after 3 tries)" : ""}</span></>}
              </span>
              <span className="row" style={{ gap: 6 }}>
                <button type="button" className="btn soft sm" onClick={() => { set("content", it.content); say("Pasted into the Content box."); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Paste</button>
                <button type="button" className="btn ghost sm" onClick={() => removeSaved(it.id)}>Delete</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card stack" style={{ borderStyle: "dashed" }}>
        <b>AI auto-fill</b>
        <p className="muted">Paste raw content above, then click. Gemini extracts slug, category, title, related tools, countries, excerpt, meta, reading time, and cleans the markdown (inlines top 5 external links naturally, strips AI commentary). Wording is not rewritten.</p>
        <button type="button" className="btn primary" disabled={busy === "ai"} onClick={aiFill}>{busy === "ai" ? "Extracting…" : "Auto-fill with AI"}</button>
      </div>

      <div className="card stack">
        <label className="stack"><span className="eyebrow">Excerpt</span><textarea className="field" rows={3} value={v.excerpt} onChange={(e) => set("excerpt", e.target.value)} /></label>
        <label className="stack"><span className="eyebrow">Meta description</span><textarea className="field" rows={2} value={v.meta_description} onChange={(e) => set("meta_description", e.target.value)} /></label>
        <label className="stack"><span className="eyebrow">OG image URL (https)</span><input className="field" value={v.og_image_url} onChange={(e) => set("og_image_url", e.target.value)} /></label>
        <label className="stack"><span className="eyebrow">Reading time (min)</span><input className="field" type="number" min={1} value={v.reading_time_minutes} onChange={(e) => set("reading_time_minutes", parseInt(e.target.value || "0", 10))} /></label>
      </div>

      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn primary big" type="submit" disabled={busy === "save"}>{busy === "save" ? "Saving…" : "Save article"}</button>
    </form>
  );
}
