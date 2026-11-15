"use client";
import { useEffect, useState } from "react";
import { enablePush, pushActive, pushMessage, pushState } from "@/lib/push";
import { supabase } from "@/lib/supabase";

const HOURS = [5, 6, 7, 8, 9, 10];
const label = (h: number) => `${h % 12 || 12}:00 ${h < 12 ? "am" : "pm"}`;

/** Today's morning message, with an optional morning notification (browser push, free). */
export default function Morning() {
  const [msg, setMsg] = useState<string | null>(null);
  const [hour, setHour] = useState<number | null>(null); // null = off
  const [pick, setPick] = useState(7);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const m = await supabase().rpc("todays_motivation");
      setMsg(typeof m.data === "string" && m.data ? m.data : "");
      const mine = await supabase().rpc("my_morning");
      const h = (mine.data as { hour: number }[] | null)?.[0]?.hour;
      if (typeof h === "number" && (await pushActive())) { setHour(h); setPick(h); }
    })();
  }, []);

  if (!msg) return null; // nothing to show until an admin adds a message

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

  return (
    <section className="card stack morning">
      <p className="eyebrow">Good morning</p>
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
  );
}
