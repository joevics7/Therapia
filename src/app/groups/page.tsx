"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ROOMS } from "@/lib/rooms";

export default function Groups() {
  const [live, setLive] = useState<Record<string, number>>({});
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch("/api/rooms", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => { if (!stop) { setLive(d.live ?? {}); setConfigured(d.configured !== false); } })
        .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const liveRooms = ROOMS.filter((r) => live[r.id]);
  const rest = ROOMS.filter((r) => !live[r.id]);

  const card = (r: (typeof ROOMS)[number]) => (
    <article key={r.id} className={`rcard pal-${r.pal}`}>
      <div className="tile ankara" aria-hidden="true" />
      <div>
        <div className="rc-cat">{r.cat}</div>
        <h3 className="display">{r.title}</h3>
        <div className="rc-host">{r.host}</div>
        <div className="rc-meta">
          {live[r.id] ? (<><span className="livepill"><i />Live</span><span>{live[r.id]} listening</span></>) : (<span style={{ fontWeight: 700 }}>{r.when} WAT</span>)}
          {r.women && <span className="badge hib">Women only</span>}
          {r.men && <span className="badge">For men</span>}
        </div>
      </div>
      <div className="rc-act">
        <Link className={`btn sm ${live[r.id] ? "accent" : "ghost"}`} href={`/room/${r.id}`}>{live[r.id] ? "Join" : "Open room"}</Link>
      </div>
    </article>
  );

  return (
    <>
      <div className="topbar"><Link className="wordmark display" href="/">Therapia</Link></div>
      <div><h1 className="display ptitle">Groups</h1><p className="muted">Free voice rooms, every week.</p></div>
      {!configured && <div className="card"><p className="fine">Audio isn&rsquo;t configured yet. Add the LiveKit values to .env.local to see live rooms.</p></div>}
      {liveRooms.length > 0 && <section className="sec"><h2 className="sec-h display"><span className="livepill"><i />Live</span>Live now</h2>{liveRooms.map(card)}</section>}
      <section className="sec"><h2 className="sec-h display">All rooms</h2>{rest.map(card)}</section>
      <p className="fine">Times are Lagos time (WAT). Anyone can open a room, but a room only goes live when its host joins.</p>
    </>
  );
}
