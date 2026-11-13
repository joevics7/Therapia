"use client";

import { useState } from "react";
import { Chips, PageHead, Sheet, useToast } from "@/components/ui";
import { money } from "@/lib/data";
import { fmtLagos } from "@/lib/rooms";
import { avatarVar, initials } from "@/lib/session";
import { useBookings, useTherapists, type Therapist } from "@/lib/hooks";

export default function Therapy() {
  const [filter, setFilter] = useState("All");
  const { list: bookings, add, cancel, signedIn } = useBookings();
  const { list: pros, slots, reload } = useTherapists();
  const [pro, setPro] = useState<Therapist | null>(null);
  const [slot, setSlot] = useState("");
  const [plan, setPlan] = useState<"one" | "month">("one");
  const [busy, setBusy] = useState(false);
  const { say, toast } = useToast();

  const all = pros ?? [];
  const filters = ["All", ...Array.from(new Set(all.flatMap((p) => p.tags)))];
  const list = all.filter((p) => filter === "All" || p.tags.includes(filter));
  const times = (id: string) => slots.filter((s) => s.therapist_id === id);
  const open = (p: Therapist) => { setPro(p); setSlot(times(p.id)[0]?.id ?? ""); setPlan("one"); };
  const price = pro ? (plan === "one" ? pro.price_ngn : Math.round((pro.price_ngn * 3.4) / 100) * 100) : 0;

  const confirm = async () => {
    if (!pro || !slot || busy) return;
    if (!signedIn) { say("Your account isn't ready yet. Try again in a moment."); return; }
    setBusy(true);
    const r = await add(pro.id, slot, plan);
    setBusy(false);
    if (r.ok) { say(`Requested ${pro.name}. Check Your sessions for its status.`); setPro(null); reload(); return; }
    say(r.code === "slot_taken" ? "Someone just took that time. Pick another." : r.code === "too_many" ? "You have several open requests. Cancel one first." : "Couldn't save the booking. Try again.");
    if (r.code === "slot_taken") { reload(); setSlot(""); }
  };

  return (
    <>
      {toast}
      <PageHead title="Therapy" sub="One-on-one voice sessions with licensed therapists." />
      <div className="card"><p>Your group name stays anonymous. Payment is kept separate from it.</p></div>
      {bookings.filter((b) => b.status !== "cancelled").length > 0 && (
        <section className="sec">
          <h2 className="sec-h display">Your sessions</h2>
          {bookings.filter((b) => b.status !== "cancelled").map((b) => (
            <div className="card" key={b.id}>
              <b>{b.pro_name}</b>
              <div className="muted">{b.slot} · {b.plan === "one" ? "Per session" : "Monthly plan"} · {money(b.price_ngn)}</div>
              <div className="fine">Status: {b.status}. The call opens 5 minutes before the start.</div>
              <button className="btn ghost sm" style={{ justifySelf: "start" }} onClick={async () => { say((await cancel(b.id)) ? "Booking cancelled." : "Couldn't cancel. Try again."); reload(); }}>Cancel</button>
            </div>
          ))}
        </section>
      )}
      {filters.length > 1 && <Chips list={filters} cur={filter} onPick={setFilter} />}
      <div className="cardgrid">
      {list.map((p) => (
        <article className={`tcard pal-${p.pal}`} key={p.id}>
          <span className="av" style={{ "--s": "56px", background: avatarVar(p.name) } as React.CSSProperties}>{initials(p.name)}</span>
          <div>
            <h3 className="display">{p.name}</h3>
            <div className="rc-host">{p.role} ✓</div>
            <div className="tags">{p.tags.map((t) => <span className="tagc" key={t}>{t}</span>)}</div>
            <p className="fine" style={{ marginTop: 8 }}>{p.bio ? `${p.bio} · ` : ""}{p.languages}</p>
          </div>
          <div className="tc-foot">
            <div><div className="price">{money(p.price_ngn)} <span className="fine" style={{ fontWeight: 500 }}>/ 45 min</span></div><div className="fine">{times(p.id)[0] ? `Next: ${fmtLagos(times(p.id)[0].starts_at)}` : "No times available"}</div></div>
            <button className="btn accent sm" disabled={times(p.id).length === 0} onClick={() => open(p)}>Book</button>
          </div>
        </article>
      ))}
      </div>
      {pros !== null && list.length === 0 && <p className="empty">{all.length === 0 ? "Therapists will appear here soon." : "No therapists for this topic yet."}</p>}

      {pro && (
        <Sheet onClose={() => setPro(null)}>
          <h3 className="display">Book {pro.name}</h3>
          <p className="muted">Voice session, 45 minutes. Times are Lagos time.</p>
          <div className="eyebrow">Pick a time</div>
          <div className="slots">{times(pro.id).map((s) => <button key={s.id} className="chip" aria-pressed={slot === s.id} onClick={() => setSlot(s.id)}>{fmtLagos(s.starts_at)}</button>)}</div>
          <div className="eyebrow">How to pay</div>
          <div className="seg" role="group" aria-label="Payment plan">
            <button aria-pressed={plan === "one"} onClick={() => setPlan("one")}>Per session</button>
            <button aria-pressed={plan === "month"} onClick={() => setPlan("month")}>Monthly, 4 sessions (save 15%)</button>
          </div>
          <p className="display" style={{ fontSize: 24, fontWeight: 800 }}>{money(price)}{plan === "one" ? " for this session" : " for 4 sessions"}</p>
          <div className="placeholder">Payment isn't set up in the app yet. Your request is saved and the team confirms it.</div>
          <button className="btn primary big" disabled={!slot || busy} onClick={confirm}>{busy ? "Booking…" : "Request booking"}</button>
        </Sheet>
      )}
    </>
  );
}
