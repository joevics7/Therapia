"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HelpSheet } from "@/components/ui";
import { AFFIRM, MOODS, MOOD_MSG, TOOLS } from "@/lib/data";
import { useRooms } from "@/lib/hooks";
import { useAuth } from "@/components/AuthProvider";
import { avatarVar, getHandle, initials, newHandle, setHandle } from "@/lib/session";
import { dayKey, useStored } from "@/lib/store";

const MOOD_COLORS = ["#F0668A", "#F59A4B", "#F4C84B", "#8FD16B", "#43C48A"];
const FACE = ["M8 18q5-5 10 0", "M8 17q5-2 10 0", "M8 16.5h10", "M8 15.5q5 3 10 0", "M8 14.5q5 6 10 0"];

function Face({ i }: { i: number }) {
  return (
    <svg width="30" height="30" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="13" fill={MOOD_COLORS[i]} />
      <circle cx="9" cy="10" r="1.6" fill="#1d1640" /><circle cx="17" cy="10" r="1.6" fill="#1d1640" />
      <path d={FACE[i]} fill="none" stroke="#1d1640" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function Dashboard() {
  const [handle, setH] = useState("");
  const [help, setHelp] = useState(false);
  const [log, setLog] = useStored<Record<string, number>>("moods", {});
  const [aff, setAff] = useState(0);
  const [live, setLive] = useState<Record<string, number>>({});
  const rooms = useRooms();
  const { isAnonymous, error: authError } = useAuth();

  useEffect(() => {
    let h = getHandle();
    if (!h) { h = newHandle(); setHandle(h); }
    setH(h);
    fetch("/api/rooms", { cache: "no-store" }).then((r) => r.json()).then((d) => setLive(d.live ?? {})).catch(() => {});
  }, []);

  const today = dayKey();
  const mood = log[today];
  const liveRooms = (rooms ?? []).filter((r) => live[r.id]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    return { k: dayKey(d), l: "SMTWTFS"[d.getDay()] };
  });

  const actions = (m: number) => {
    if (m <= 1) return (<><Link className="btn accent sm" href="/tools">Try one minute of breathing</Link><button className="btn ghost sm" onClick={() => setHelp(true)}>♥ Need help now</button></>);
    if (m === 2) return (<><Link className="btn accent sm" href="/groups">See live rooms</Link><Link className="btn ghost sm" href="/tools">Write a few lines</Link></>);
    if (m === 3) return <Link className="btn accent sm" href="/tools">Write it down</Link>;
    return <Link className="btn accent sm" href="/groups">Join a live room</Link>;
  };

  return (
    <div className="dash">
      <header className="home-top">
        <div className="who">
          <span className="av" style={{ "--s": "44px", background: avatarVar(handle || "x") } as React.CSSProperties}>{initials(handle)}</span>
          <div className="hello display">Hi, {handle || "friend"}</div>
        </div>
        <button className="pill-help" onClick={() => setHelp(true)}>♥ Need help now</button>
      </header>

      <div className="dash-main">
      <section className="card">
        <h2 className="sec-h display">How are you today?</h2>
        <div className="moods">
          {MOODS.map((lab, i) => (
            <button key={lab} className="mood" style={{ "--mc": MOOD_COLORS[i] } as React.CSSProperties} aria-pressed={mood === i} onClick={() => setLog((p) => ({ ...p, [today]: i }))}>
              <Face i={i} />{lab}
            </button>
          ))}
        </div>
        {mood !== undefined && <div className="mood-resp"><p>{MOOD_MSG[mood]}</p><div className="act-btns">{actions(mood)}</div></div>}
        <div>
          <div className="eyebrow">Your week</div>
          <div className="week" role="img" aria-label="Your mood this week">
            {days.map((d) => {
              const v = log[d.k];
              return (
                <div className="wd" key={d.k}>
                  {v === undefined ? <span className="bar none" style={{ height: "16%" }} /> : <span className="bar" style={{ height: `${24 + v * 19}%`, background: MOOD_COLORS[v] }} />}
                  <span className="dl">{d.l}</span>
                </div>
              );
            })}
          </div>
          <p className="fine">Only you can see this. It stays on this device.</p>
        </div>
      </section>

      {liveRooms.length > 0 && (
        <section className="sec">
          <h2 className="sec-h display"><span className="livepill"><i />Live</span>Live now</h2>
          {liveRooms.map((r) => (
            <article key={r.id} className={`rcard pal-${r.pal}`}>
              <div className="tile ankara" aria-hidden="true" />
              <div><div className="rc-cat">{r.cat}</div><h3 className="display">{r.title}</h3><div className="rc-host">{r.host} · {live[r.id]} listening</div></div>
              <div className="rc-act"><Link className="btn accent sm" href={`/room/${r.id}`}>Join</Link></div>
            </article>
          ))}
        </section>
      )}
      <Link className="btn ghost" href="/groups">All groups →</Link>

      {isAnonymous && !authError && (
        <section className="notice">
          <b>Keep your data safe.</b> Your account lives on this phone. Make a recovery phrase to get it back on a new phone, with no email or number.
          <div className="row" style={{ marginTop: 10 }}><Link className="btn primary sm" href="/account">Set up recovery</Link></div>
        </section>
      )}

      </div>
      <div className="dash-side">
      <section className="sec">
        <h2 className="sec-h display">Quick tools</h2>
        <div className="toolgrid">
          {TOOLS.map((x) => (
            <Link key={x.id} className="toolcard" href={`/tools#${x.id}`}>
              <span className="ic">{x.icon}</span><b className="display">{x.name}</b><span className="muted">{x.sub}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="affirm">
        <div className="strip ankara pal-b" aria-hidden="true" />
        <div className="body">
          <p className="quote display">{AFFIRM[aff]}</p>
          <button className="btn ghost sm" onClick={() => setAff((a) => (a + 1 + Math.floor(Math.random() * (AFFIRM.length - 1))) % AFFIRM.length)}>Another one</button>
        </div>
      </section>

      <section className="card promo">
        <div className="tile ankara pal-b" aria-hidden="true" />
        <div><h3 className="display">Want to talk one-on-one?</h3><p className="muted">Book a voice session with a licensed therapist.</p></div>
        <div className="act"><Link className="btn primary sm" href="/therapy">See therapists</Link></div>
      </section>
      <div className="topbar"><Link className="btn ghost sm" href="/">About Therapia</Link></div>
      </div>
      {help && <HelpSheet onClose={() => setHelp(false)} />}
    </div>
  );
}
