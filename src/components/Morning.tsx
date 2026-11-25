"use client";
import { useEffect, useState } from "react";
import { enablePush, pushActive, pushMessage, pushState } from "@/lib/push";
import { supabase } from "@/lib/supabase";
import NeedsPicker from "./NeedsPicker";
import { needLabel } from "@/lib/needs";

const HOURS = [5, 6, 7, 8, 9, 10];
const label = (h: number) => `${h % 12 || 12}:00 ${h < 12 ? "am" : "pm"}`;

/** Today's morning message, with an optional morning notification (browser push, free). */
export default function Morning() {
  const [msg, setMsg] = useState<string | null>(null);
  const [hour, setHour] = useState<number | null>(null); // null = off
  const [pick, setPick] = useState(7);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [needs, setNeeds] = useState<string[] | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    (async () => {
      const m = await supabase().rpc("my_motivation");
      setMsg(typeof m.data === "string" && m.data ? m.data : "");
      const n = await supabase().from("user_needs").select("needs").maybeSingle();
      setNeeds((n.data as { needs: string[] } | null)?.needs ?? []);
      const mine = await supabase().rpc("my_morning");
      const h = (mine.data as { hour: number }[] | null)?.[0]?.hour;
      if (typeof h === "number" && (await pushActive())) { setHour(h); setPick(h); }
    })();
  }, []);

  async function saveNeeds(v: string[]) {
    setNeeds(v);
    await supabase().from("user_needs").upsert({ needs: v });
    const m = await supabase().rpc("my_motivation");
    setMsg(typeof m.data === "string" && m.data ? m.data : "");
  }
  if (msg === null) return <p className="muted">Loading…</p>;

  async function turnOn() {
    setNote(""); setBusy(true);
    const st = pushState();
    if (st !== "ready") { setBusy(false); setNote(pushMessage[st]); return; }
    let ok = false;
    try { ok = await enablePush(); } catch { ok = false; }
    if (!ok) { setBusy(false); setNote(pushState() === "denied" ? pushMessage.denied : "Notifications weren't allowed, so we can't send it."); return; }
    const r = await supabase().rpc("set_morning", { p_hour: pick, p_tz: -new Date().getTimezoneOffset() });
    setBusy(false);
    if (r.error) { setNote("Couldn't save that. Try again."); return; }
    setHour(pick); setNote(`You'll get it around ${label(pick)}.`);
  }
  async function turnOff() {
    setBusy(true);
    await supabase().rpc("clear_morning");
    setBusy(false); setHour(null); setNote("");
  }

  const topics = (
    <section className="card stack">
      <span className="eyebrow">Your topics</span>
      {!editing ? (
        <>
          <p className="muted" style={{ margin: 0 }}>{needs && needs.length ? needs.map(needLabel).join(", ") : "None chosen. You get general messages."}</p>
          <button className="btn soft sm" onClick={() => setEditing(true)}>Change topics</button>
        </>
      ) : (
        <>
          <NeedsPicker value={needs ?? []} onChange={saveNeeds} />
          <button className="btn primary sm" onClick={() => setEditing(false)}>Done</button>
        </>
      )}
    </section>
  );
  if (!msg) return <><p className="empty">Morning messages are coming soon.</p>{topics}</>;

  return (
    <>
    <section className="card stack morning">
      <p className="quote display" style={{ margin: 0 }}>{msg}</p>
      {hour === null ? (
        <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <label className="fine" htmlFor="m-h">Send it to me at</label>
          <select id="m-h" className="field" style={{ width: "auto" }} value={pick} onChange={(e) => setPick(Number(e.target.value))}>{HOURS.map((h) => <option key={h} value={h}>{label(h)}</option>)}</select>
          <button className="btn soft sm" disabled={busy} onClick={turnOn}>Turn on</button>
        </span>
      ) : (
        <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <span className="fine">✓ Morning message on, around {label(hour)}</span>
          <button className="btn ghost sm" disabled={busy} onClick={turnOff}>Turn off</button>
        </span>
      )}
      {note && <p className="fine" role="status">{note}</p>}
    </section>
    {topics}
    </>
  );
}
