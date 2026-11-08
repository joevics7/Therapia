"use client";

import { useState } from "react";
import { Chips, PageHead, Sheet, useToast } from "@/components/ui";
import { PRO_FILTERS, PROS, type Pro, money } from "@/lib/data";
import { avatarVar, initials } from "@/lib/session";
import { useBookings } from "@/lib/hooks";

export default function Therapy() {
  const [filter, setFilter] = useState("All");
  const { list: bookings, add, cancel, signedIn } = useBookings();
  const [pro, setPro] = useState<Pro | null>(null);
  const [slot, setSlot] = useState("");
  const [plan, setPlan] = useState<"one" | "month">("one");
  const { say, toast } = useToast();

  const list = PROS.filter((p) => filter === "All" || p.tags.includes(filter));
  const open = (p: Pro) => { setPro(p); setSlot(p.slots[0]); setPlan("one"); };
  const price = pro ? (plan === "one" ? pro.price : Math.round((pro.price * 4 * 0.85) / 100) * 100) : 0;

  const confirm = async () => {
    if (!pro) return;
    if (!signedIn) { say("Your account isn't ready yet. Try again in a moment."); return; }
    const ok = await add({ pro_id: pro.id, pro_name: pro.name, slot, plan, price_ngn: price });
    say(ok ? `Requested ${pro.name}. Prototype: no payment taken.` : "Couldn't save the booking. Try again.");
    if (ok) setPro(null);
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
              <button className="btn ghost sm" style={{ justifySelf: "start" }} onClick={async () => say((await cancel(b.id)) ? "Booking cancelled." : "Couldn't cancel. Try again.")}>Cancel</button>
            </div>
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
