"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { PageHead, useToast } from "@/components/ui";
import { useReminders, useRooms } from "@/lib/hooks";
import { enablePush, pushMessage, pushState } from "@/lib/push";
import { hostLabel, type RoomDef } from "@/lib/rooms";

export default function Groups() {
  const rooms = useRooms();
  const { on, toggle } = useReminders();
  const { error: authError } = useAuth();
  const { say, toast } = useToast();
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

  const remind = async (r: RoomDef) => {
    if (authError) { say("Reminders need an account, which isn't ready yet."); return; }
    if (!on[r.id]) {
      // Turning a reminder on needs permission to show notifications on this device.
      const st = pushState();
      if (st !== "ready") { say(pushMessage[st]); return; }
      let ok = false;
      try { ok = await enablePush(); } catch { ok = false; }
      if (!ok) { say(pushState() === "denied" ? pushMessage.denied : "Notifications weren't allowed, so we can't remind you."); return; }
    }
    const x = await toggle(r.id);
    say(!x.ok ? "Couldn't save that. Try again." : x.now ? "Done. We'll send a notification about 15 minutes before each session." : "Reminder removed.");
  };

  const list = rooms ?? [];
  const liveRooms = list.filter((r) => r.id in live);
  const rest = list.filter((r) => !(r.id in live));

  const card = (r: RoomDef) => (
    <article key={r.id} className={`rcard pal-${r.pal}`}>
      <div className="tile ankara" aria-hidden="true" />
      <div>
        <div className="rc-cat">{r.cat}</div>
        <h3 className="display">{r.title}</h3>
        <div className="rc-host">{hostLabel(r.host)}</div>
        <div className="rc-meta">
          {r.id in live ? (<><span className="livepill"><i />Live</span><span>{live[r.id]} listening</span></>) : (<span style={{ fontWeight: 700 }}>{r.next ? `Next: ${r.next}` : `${r.when} WAT`}</span>)}
          {r.women && <span className="badge hib">Women only</span>}
          {r.men && <span className="badge">For men</span>}
        </div>
      </div>
      <div className="rc-act row">
        <Link className={`btn sm ${r.id in live ? "accent" : "ghost"}`} href={`/room/${r.id}`}>{r.id in live ? "Join" : "Open room"}</Link>
        <Link className="btn sm ghost" href={`/chat/${r.id}`}>Chat</Link>
        {!(r.id in live) && <button className="btn sm soft" aria-pressed={!!on[r.id]} onClick={() => remind(r)}>{on[r.id] ? "Reminder on ✓" : "Remind me"}</button>}
      </div>
    </article>
  );

  return (
    <>
      {toast}
      <PageHead title="Groups" sub="Free voice rooms, every week." />
      {!configured && <div className="card"><p className="fine">Audio isn&rsquo;t configured yet. Add the LiveKit values to .env.local to see live rooms.</p></div>}
      {rooms === null && <p className="muted">Loading groups…</p>}
      {liveRooms.length > 0 && <section className="sec"><h2 className="sec-h display"><span className="livepill"><i />Live</span>Live now</h2>{liveRooms.map(card)}</section>}
      {rooms !== null && <section className="sec"><h2 className="sec-h display">All groups</h2>{rest.map(card)}</section>}
      <p className="fine">Times are Lagos time (WAT). A room goes live when its host joins. Reminders arrive as a notification on this device, about 15 minutes before a session, and never name the group. Group chat is text only and messages disappear after 7 days.</p>
    </>
  );
}
