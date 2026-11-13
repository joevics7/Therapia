"use client";

import Link from "next/link";
import { CRISIS_STEPS } from "@/lib/help";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ui";
import JoinRequests from "@/components/JoinRequests";
import { fmtLagos, ROOM_COLS, type RoomDef, toRoom } from "@/lib/rooms";
import { supabase } from "@/lib/supabase";

type Session = { id: string; room_id: string; starts_at: string; note: string | null };
type Report = { id: string; room_id: string; reason: string; body_snapshot: string | null; created_at: string; vent_id?: number | null };

export default function Host() {
  const { ready, role, signOut } = useAuth();
  const isAdmin = role === "admin";
  const { say, toast } = useToast();
  const [rooms, setRooms] = useState<RoomDef[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loaded, setLoaded] = useState(false);
  const staff = role !== "listener";

  const load = useCallback(async () => {
    const sb = supabase();
    const { data: ids } = await sb.rpc("my_hosted_rooms");
    const list = (ids ?? []) as string[];
    if (!list.length) { setRooms([]); setSessions([]); setReports([]); setLoaded(true); return; }
    const since = new Date(Date.now() - 3600_000).toISOString();
    const [r, s, p] = await Promise.all([
      sb.from("rooms").select(ROOM_COLS).in("id", list).order("created_at"),
      sb.from("sessions").select("id,room_id,starts_at,note").in("room_id", list).gte("starts_at", since).order("starts_at"),
      sb.from("reports").select("id,room_id,reason,body_snapshot,created_at,vent_id").in("room_id", list).eq("status", "open").order("created_at", { ascending: false }),
    ]);
    setRooms(((r.data ?? []) as Record<string, unknown>[]).map(toRoom));
    setSessions((s.data ?? []) as Session[]);
    setReports((p.data ?? []) as Report[]);
    setLoaded(true);
  }, []);

  useEffect(() => { if (ready && staff) load(); else if (ready) setLoaded(true); }, [ready, staff, load]);

  if (!ready || !loaded) return <p className="muted">Loading…</p>;
  if (!staff) {
    return (
      <div className="pg-narrow">
        <div className="topbar"><Link className="wordmark display" href="/">Therapia</Link></div>
        <div className="card"><p>Host tools are for signed-in facilitators.</p><Link className="btn primary" href="/host/login">Facilitator sign-in</Link></div>
      </div>
    );
  }

  async function resolve(rep: Report, action: "dismiss" | "delete_message" | "block") {
    const { error } = await supabase().rpc("resolve_report", { p_report: rep.id, p_action: action });
    if (error) { say("That didn't work. Try again."); return; }
    setReports((x) => x.filter((y) => y.id !== rep.id));
    say(action === "block" ? "Blocked from the group. Their messages were removed." : action === "delete_message" ? "Message deleted." : "Report dismissed.");
  }

  return (
    <div className="pg-narrow">
      {toast}
      <div className="topbar"><Link className="wordmark display" href="/">Therapia</Link>{isAdmin && <Link className="btn soft sm" href="/admin">Admin</Link>}<button className="btn ghost sm" onClick={signOut}>Sign out</button></div>
      <div><h1 className="display ptitle">Host tools</h1><p className="muted">Signed in as {role}.</p></div>

      <details className="card crisis">
        <summary><b>If someone in your room is in crisis</b></summary>
        <ol>{CRISIS_STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
      </details>

      {rooms.length === 0 && <div className="card"><p>No groups are assigned to you yet. The Therapia owner links your account to your group.</p></div>}

      {reports.length > 0 && (
        <section className="sec">
          <h2 className="sec-h display">Reports to review <span className="count">{reports.length}</span></h2>
          {reports.map((rep) => (
            <div className="rep" key={rep.id}>
              <div className="fine">{rooms.find((r) => r.id === rep.room_id)?.title} · {rep.vent_id ? "Vent · " : ""}{fmtLagos(rep.created_at)}</div>
              <blockquote>{rep.body_snapshot ?? "(message unavailable)"}</blockquote>
              {rep.reason && <p className="muted">Reason: {rep.reason}</p>}
              <div className="row">
                <button className="btn soft sm" onClick={() => resolve(rep, "delete_message")}>Delete message</button>
                <button className="btn soft sm" onClick={() => resolve(rep, "block")}>Block from group</button>
                <button className="btn ghost sm" onClick={() => resolve(rep, "dismiss")}>Dismiss</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {rooms.map((r) => (
        <HostRoom key={r.id} room={r} sessions={sessions.filter((s) => s.room_id === r.id)} reload={load} say={say} />
      ))}
    </div>
  );
}

function HostRoom({ room, sessions, reload, say }: { room: RoomDef; sessions: Session[]; reload: () => void; say: (m: string) => void }) {
  const [sched, setSched] = useState(room.when);
  const [code, setCode] = useState("");
  const [days, setDays] = useState(30);
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");

  async function saveSched() {
    const { error } = await supabase().from("rooms").update({ schedule_text: sched.trim() }).eq("id", room.id);
    say(error ? "Couldn't save. Try again." : "Schedule saved.");
    if (!error) reload();
  }
  async function saveCode(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase().rpc("set_room_code", { p_room: room.id, p_code: code, p_days: days });
    if (error) { say(error.message.includes("code_length") ? "Use 4 to 40 characters." : "Couldn't save the code."); return; }
    setCode("");
    say("New invite code saved. The old one no longer works.");
  }
  async function addSession(e: React.FormEvent) {
    e.preventDefault();
    if (!when) return;
    const { error } = await supabase().from("sessions").insert({ room_id: room.id, starts_at: new Date(when).toISOString(), note: note.trim() || null });
    if (error) { say("Couldn't add the session."); return; }
    setWhen(""); setNote(""); say("Session added."); reload();
  }
  async function removeSession(id: string) {
    const { error } = await supabase().from("sessions").delete().eq("id", id);
    if (!error) reload();
  }

  return (
    <section className="card">
      <div className="rc-cat">{room.cat}{room.women ? " · Women only" : ""}</div>
      <h2 className="sec-h display">{room.title}</h2>
      <div className="row">
        <Link className="btn accent sm" href={`/room/${room.id}`}>Go live</Link>
        <Link className="btn ghost sm" href={`/chat/${room.id}`}>Open chat</Link>
      </div>

      <JoinRequests roomId={room.id} say={say} />

      <div className="stack">
        <label htmlFor={`s-${room.id}`} className="eyebrow">Regular schedule (shown to everyone)</label>
        <div className="row"><input id={`s-${room.id}`} className="field" style={{ flex: 1 }} value={sched} onChange={(e) => setSched(e.target.value)} maxLength={80} /><button className="btn soft sm" onClick={saveSched}>Save</button></div>
      </div>

      <form className="stack" onSubmit={addSession}>
        <span className="eyebrow">Add a dated session</span>
        <input className="field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Session date and time" required />
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Note (optional)" aria-label="Note" />
        <button className="btn soft sm" type="submit" style={{ justifySelf: "start" }}>Add session</button>
        <p className="fine">Uses this device&rsquo;s clock. Nigeria is WAT (UTC+1).</p>
      </form>
      {sessions.map((s) => (
        <div className="sess" key={s.id}><span>{fmtLagos(s.starts_at)}{s.note ? ` · ${s.note}` : ""}</span><button className="btn ghost sm" onClick={() => removeSession(s.id)}>Remove</button></div>
      ))}

      {room.women && (
        <form className="stack" onSubmit={saveCode}>
          <span className="eyebrow">Women-only invite code</span>
          <input className="field" value={code} onChange={(e) => setCode(e.target.value)} placeholder="New code, 4–40 characters" autoComplete="off" aria-label="New invite code" />
          <div className="row">
            <select className="field" style={{ flex: 1 }} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Code lasts">
              <option value={7}>Valid 7 days</option><option value={30}>Valid 30 days</option><option value={90}>Valid 90 days</option><option value={0}>No expiry</option>
            </select>
            <button className="btn soft sm" type="submit" disabled={code.trim().length < 4}>Set code</button>
          </div>
          <p className="fine">Codes are stored scrambled, so nobody can read the current one. Setting a new code replaces it. People already in the group stay in.</p>
        </form>
      )}
    </section>
  );
}
