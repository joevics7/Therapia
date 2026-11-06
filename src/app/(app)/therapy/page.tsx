"use client";

import { useState } from "react";
import { Chips, PageHead, Sheet, useToast } from "@/components/ui";
import { PRO_FILTERS, PROS, type Pro, money } from "@/lib/data";
import { avatarVar, initials } from "@/lib/session";
import { useStored } from "@/lib/store";

type Booking = { name: string; slot: string; plan: string };

export default function Therapy() {
  const [filter, setFilter] = useState("All");
  const [bookings, setBookings] = useStored<Booking[]>("bookings", []);
  const [pro, setPro] = useState<Pro | null>(null);
  const [slot, setSlot] = useState("");
  const [plan, setPlan] = useState<"one" | "month">("one");
  const { say, toast } = useToast();

  const list = PROS.filter((p) => filter === "All" || p.tags.includes(filter));
  const open = (p: Pro) => { setPro(p); setSlot(p.slots[0]); setPlan("one"); };
  const price = pro ? (plan === "one" ? pro.price : Math.round((pro.price * 4 * 0.85) / 100) * 100) : 0;

  const confirm = () => {
    if (!pro) return;
    setBookings((b) => [...b, { name: pro.name, slot, plan: plan === "one" ? "Per session" : "Monthly plan" }]);
    say(`Booked with ${pro.name}. Prototype: no payment taken.`);
    setPro(null);
  };

  return (
    <>
      {toast}
      <PageHead title="Therapy" sub="One-on-one voice sessions with licensed therapists." />
      <div className="card"><p>Your group name stays anonymous. Payment is kept separate from it.</p></div>
      {bookings.length > 0 && (
        <section className="sec">
          <h2 className="sec-h display">Your sessions</h2>
          {bookings.map((b, i) => (
            <div className="card" key={i}><b>{b.name}</b><div className="muted">{b.slot} · {b.plan}</div><div className="fine">The call opens 5 minutes before the start.</div></div>
          ))}
        </section>
      )}
      <Chips list={PRO_FILTERS} cur={filter} onPick={setFilter} />
      {list.map((p) => (
        <article className={`tcard pal-${p.pal}`} key={p.id}>
          <span className="av" style={{ "--s": "56px", background: avatarVar(p.name) } as React.CSSProperties}>{initials(p.name)}</span>
          <div>
            <h3 className="display">{p.name}</h3>
            <div className="rc-host">{p.role} ✓</div>
            <div className="tags">{p.tags.map((t) => <span className="tagc" key={t}>{t}</span>)}</div>
            <p className="fine" style={{ marginTop: 8 }}>{p.lang}</p>
          </div>
          <div className="tc-foot">
            <div><div className="price">{money(p.price)} <span className="fine" style={{ fontWeight: 500 }}>/ 45 min</span></div><div className="fine">Next: {p.slots[0]}</div></div>
            <button className="btn accent sm" onClick={() => open(p)}>Book</button>
          </div>
        </article>
      ))}
      {list.length === 0 && <p className="empty">No therapists for this topic yet.</p>}
      <p className="fine">Sample profiles and prices. Real therapists are verified before they appear.</p>

      {pro && (
        <Sheet onClose={() => setPro(null)}>
          <h3 className="display">Book {pro.name}</h3>
          <p className="muted">Voice session, 45 minutes. Times are Lagos time.</p>
          <div className="eyebrow">Pick a time</div>
          <div className="slots">{pro.slots.map((s) => <button key={s} className="chip" aria-pressed={slot === s} onClick={() => setSlot(s)}>{s}</button>)}</div>
          <div className="eyebrow">How to pay</div>
          <div className="seg" role="group" aria-label="Payment plan">
            <button aria-pressed={plan === "one"} onClick={() => setPlan("one")}>Per session</button>
            <button aria-pressed={plan === "month"} onClick={() => setPlan("month")}>Monthly, 4 sessions</button>
          </div>
          <p className="display" style={{ fontSize: 24, fontWeight: 800 }}>{money(price)}{plan === "one" ? " for this session" : " for 4 sessions"}</p>
          <div className="placeholder">Prototype: no payment is taken.</div>
          <button className="btn primary big" onClick={confirm}>Confirm booking</button>
        </Sheet>
      )}
    </>
  );
}
