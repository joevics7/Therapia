"use client";
import { useEffect, useState } from "react";
import { type RoomDef, UNASSIGNED } from "@/lib/rooms";
import { avatarVar, initials } from "@/lib/session";

const Avatar = ({ name, size }: { name: string; size: number }) => (
  <span className="av" style={{ "--s": `${size}px`, background: avatarVar(name) } as React.CSSProperties} aria-hidden="true">{initials(name)}</span>
);

function left(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d >= 1) return `${d} day${d === 1 ? "" : "s"} ${h} hr`;
  if (h >= 1) return `${h} hr ${m} min`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** Before the meeting starts: what the group is about, who leads it, and how long until it begins. Hidden once it is live. */
export default function GroupIntro({ room }: { room: RoomDef }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const at = room.nextAt ? new Date(room.nextAt).getTime() : null;
  const names = room.host === UNASSIGNED ? [] : room.host.split(/\s*(?:,|&| and )\s*/).filter(Boolean);

  return (
    <section className="card stack groupintro">
      {at !== null && (
        <div>
          <span className="eyebrow">{at > now ? "Meeting starts in" : "Meeting time"}</span>
          <b className="display" style={{ display: "block", fontSize: 28 }} aria-live="off">{at > now ? left(at - now) : "Waiting for the facilitator"}</b>
          {room.next && <span className="fine">{room.next} (Nigeria time)</span>}
        </div>
      )}
      {room.about && <p style={{ margin: 0 }}>{room.about}</p>}
      <div>
        <span className="eyebrow">{names.length > 1 ? "Facilitators" : "Facilitator"}</span>
        {names.length === 0 ? <p className="muted" style={{ margin: "4px 0 0" }}>To be announced.</p> : (
          <div className="stack" style={{ marginTop: 6, gap: 8 }}>
            {names.map((n) => <span className="row" style={{ gap: 10, alignItems: "center" }} key={n}><Avatar name={n} size={36} /><b>{n}</b></span>)}
          </div>
        )}
      </div>
    </section>
  );
}
