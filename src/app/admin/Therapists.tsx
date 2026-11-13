"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtLagos } from "@/lib/rooms";

type Call = (action: string, body?: object) => Promise<{ ok: boolean; data: Record<string, unknown> }>;
type Say = (m: string) => void;
type Th = { id: string; name: string; role: string; bio: string | null; tags: string[]; languages: string; price_ngn: number; pal: string; active: boolean };
type Slot = { id: string; therapist_id: string; starts_at: string; booked: boolean };
type Bk = { id: string; pro_name: string; slot: string; plan: string; price_ngn: number; status: string; username: string; created_at: string };

const BLANK: Th = { id: "", name: "", role: "", bio: "", tags: [], languages: "English", price_ngn: 5000, pal: "a", active: false };
const PALS = ["a", "b", "c", "d", "e"];
const naira = (n: number) => "₦" + n.toLocaleString("en-US");

export function Therapists({ call, say }: { call: Call; say: Say }) {
  const [list, setList] = useState<Th[] | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [edit, setEdit] = useState<Th | null>(null);
  const load = useCallback(async () => {
    const r = await call("therapists.list");
    setList((r.data.therapists as Th[]) ?? []);
    setSlots((r.data.slots as Slot[]) ?? []);
  }, [call]);
  useEffect(() => { load(); }, [load]);

  if (list === null) return <p className="muted">Loading…</p>;
  if (edit) return <Editor key={edit.id || "new"} start={edit} slots={slots.filter((s) => s.therapist_id === edit.id)} call={call} say={say} reload={load} onClose={() => setEdit(null)} />;
  return (
    <section className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 className="display ptitle" style={{ fontSize: 24, margin: 0 }}>Therapists ({list.length})</h1>
        <button className="btn accent sm" onClick={() => setEdit(BLANK)}>+ Add therapist</button>
      </div>
      <p className="muted">Only therapists marked Visible appear to members, and only with times you have added.</p>
      <div className="adm-grid">
        {list.map((t) => {
          const free = slots.filter((s) => s.therapist_id === t.id && !s.booked).length;
          return (
            <article className={`card adm-card pal-${t.pal}`} key={t.id}>
              <div className="rc-cat">{t.role}</div>
              <h2 className="display" style={{ fontSize: 19, margin: "2px 0" }}>{t.name}</h2>
              <div className="fine">{naira(t.price_ngn)} per session · {t.tags.join(", ") || "No topics"}</div>
              <div className="rc-meta" style={{ margin: "8px 0" }}>
                {!t.active && <span className="badge">Hidden</span>}
                <span className="fine">{free} free time{free === 1 ? "" : "s"}</span>
              </div>
              <button className="btn soft sm" onClick={() => setEdit(t)}>Edit</button>
            </article>
          );
        })}
      </div>
      <Bookings call={call} say={say} onChanged={load} />
    </section>
  );
}

function Editor({ start, slots, call, say, reload, onClose }: { start: Th; slots: Slot[]; call: Call; say: Say; reload: () => Promise<void>; onClose: () => void }) {
  const isNew = !start.id;
  const [f, setF] = useState<Th>(start);
  const [tags, setTags] = useState(start.tags.join(", "));
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Th>(k: K, v: Th[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    const r = await call("therapist.save", { ...f, id: isNew ? undefined : f.id, tags: tags.split(",").map((x) => x.trim()).filter(Boolean) });
    setBusy(false);
    if (!r.ok) { say(String(r.data.error ?? "Couldn't save.")); return; }
    say(isNew ? "Therapist added. Now add some available times." : "Saved.");
    await reload();
    if (isNew) onClose();
  }
  async function remove() {
    if (!window.confirm(`Delete ${f.name}? Their profile and open times are removed. To just hide them, untick Visible.`)) return;
    const r = await call("therapist.delete", { id: f.id });
    if (!r.ok) { say(String(r.data.error ?? "Couldn't delete.")); return; }
    await reload(); onClose();
  }
  async function addSlot() {
    const r = await call("slot.add", { therapist_id: f.id, starts_at: new Date(`${at}:00+01:00`).toISOString() });
    if (!r.ok) { say(String(r.data.error ?? "Couldn't add.")); return; }
    setAt(""); say("Time added."); reload();
  }
  async function delSlot(id: string) {
    const r = await call("slot.delete", { id });
    if (!r.ok) { say(String(r.data.error ?? "Couldn't remove.")); return; }
    reload();
  }

  return (
    <section className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 className="display ptitle" style={{ fontSize: 24, margin: 0 }}>{isNew ? "Add therapist" : "Edit therapist"}</h1>
        <button className="btn ghost sm" onClick={onClose}>← All therapists</button>
      </div>
      <div className="card stack">
        <label className="stack"><span className="eyebrow">Name</span><input className="field" value={f.name} maxLength={60} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Dr Amaka Obi" /></label>
        <label className="stack"><span className="eyebrow">Title</span><input className="field" value={f.role} maxLength={60} onChange={(e) => set("role", e.target.value)} placeholder="e.g. Clinical psychologist" /></label>
        <label className="stack"><span className="eyebrow">Short bio (optional)</span><textarea className="field" rows={3} value={f.bio ?? ""} maxLength={400} onChange={(e) => set("bio", e.target.value)} /></label>
        <label className="stack"><span className="eyebrow">Topics (separate with commas)</span><input className="field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Marriage, Trauma, Grief" /></label>
        <label className="stack"><span className="eyebrow">Languages</span><input className="field" value={f.languages} maxLength={60} onChange={(e) => set("languages", e.target.value)} placeholder="English, Yoruba" /></label>
        <label className="stack"><span className="eyebrow">Price per 45-minute session (₦)</span><input className="field" type="number" min={0} step={500} value={f.price_ngn} onChange={(e) => set("price_ngn", Number(e.target.value))} /></label>
        <div><span className="eyebrow">Colour</span>
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            {PALS.map((p) => <button key={p} type="button" aria-label={`Colour ${p}`} aria-pressed={f.pal === p} onClick={() => set("pal", p)} className={`swatch ankara pal-${p}`} />)}
          </div>
        </div>
        <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} />Visible to members</label>
        <button className="btn primary big" disabled={busy} onClick={save}>{busy ? "Saving…" : isNew ? "Add therapist" : "Save changes"}</button>
      </div>

      {!isNew && (
        <>
          <div className="card stack">
            <h2 className="sec-h display" style={{ margin: 0 }}>Available times</h2>
            <p className="muted">Members can only book times listed here. Times are Nigeria time (WAT).</p>
            {slots.length === 0 && <p className="fine">No upcoming times. Add some below.</p>}
            <div className="adm-scroll">
              {slots.map((s) => (
                <div className="row adm-line" key={s.id}>
                  <span><b>{fmtLagos(s.starts_at)}</b> {s.booked && <span className="badge">Booked</span>}</span>
                  {!s.booked && <button className="btn ghost sm" onClick={() => delSlot(s.id)}>Remove</button>}
                </div>
              ))}
            </div>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              <input className="field" style={{ flex: "0 0 220px" }} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} aria-label="Available date and time" />
              <button className="btn primary" disabled={!at} onClick={addSlot}>Add time</button>
            </div>
          </div>
          <div className="card"><button className="btn ghost" onClick={remove}>Delete this therapist</button></div>
        </>
      )}
    </section>
  );
}

function Bookings({ call, say, onChanged }: { call: Call; say: Say; onChanged: () => Promise<void> }) {
  const [list, setList] = useState<Bk[] | null>(null);
  const load = useCallback(async () => { const r = await call("bookings.list"); setList((r.data.bookings as Bk[]) ?? []); }, [call]);
  useEffect(() => { load(); }, [load]);
  async function set(id: string, status: string) {
    const r = await call("booking.set", { id, status });
    if (!r.ok) { say("Couldn't update."); return; }
    say(status === "confirmed" ? "Confirmed." : "Updated."); load(); onChanged();
  }
  const open = (list ?? []).filter((b) => b.status !== "cancelled");
  return (
    <div className="card stack">
      <h2 className="sec-h display" style={{ margin: 0 }}>Bookings ({open.length})</h2>
      <p className="muted">Booking requests from members. Payment is not collected by the app yet. Confirm a booking once you have been paid, or cancel it to free the time.</p>
      {list && open.length === 0 && <p className="fine">No bookings yet.</p>}
      {open.map((b) => (
        <div className="row adm-line" key={b.id}>
          <span><b>{b.pro_name}</b> · {b.slot} · {b.plan === "one" ? "1 session" : "monthly"} · {naira(b.price_ngn)}<br /><span className="fine">Member: {b.username} · {b.status}</span></span>
          <span className="row" style={{ gap: 6 }}>
            {b.status !== "confirmed" && <button className="btn soft sm" onClick={() => set(b.id, "confirmed")}>Confirm</button>}
            <button className="btn ghost sm" onClick={() => set(b.id, "cancelled")}>Cancel</button>
          </span>
        </div>
      ))}
    </div>
  );
}
