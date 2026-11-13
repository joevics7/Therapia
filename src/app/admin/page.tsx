"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ui";
import { authPost } from "@/lib/api";
import { fmtLagos } from "@/lib/rooms";
import { supabase } from "@/lib/supabase";
import { Therapists } from "./Therapists";

type Room = { id: string; title: string; cat: string; host_name: string; host_id: string | null; women_only: boolean; men_only: boolean; pal: string; schedule_text: string | null; days: number[]; start_time: string | null; active: boolean };
type Fac = { user_id: string; username: string; display_name: string | null };
type Sess = { id: string; room_id: string; starts_at: string; note: string | null };
type Code = { room_id: string; expires_at: string | null };
type Overview = { rooms: Room[]; facilitators: Fac[]; codes: Code[]; sessions: Sess[]; counts: Record<string, { members: number; banned: number }> };
type Mem = { alias: string; handle: string; banned: boolean; joined_at: string };
type Rep = { id: string; room_id: string; reason: string; body_snapshot: string | null; created_at: string; vent_id?: number | null };
type Call = (action: string, body?: object) => Promise<{ ok: boolean; data: Record<string, unknown> }>;

const BLANK: Room = { id: "", title: "", cat: "", host_name: "", host_id: null, women_only: false, men_only: false, pal: "a", schedule_text: "", days: [], start_time: "19:00", active: true };
const PALS = ["a", "b", "c", "d", "e"];

/** Email + password sign-in for admins. There is no sign-up here. Accounts are made by the site owner in Supabase. */
function AdminSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr("That email or password didn't work.");
    // On success the page re-checks the account. Non-admin accounts are sent to the homepage.
  }
  return (
    <div className="pg-narrow">
      <div className="topbar"><span className="wordmark display">Therapia <small className="muted">admin</small></span></div>
      <h1 className="display ptitle">Admin sign-in</h1>
      <form className="card" onSubmit={submit}>
        <label htmlFor="ae" className="eyebrow">Email</label>
        <input id="ae" className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="ap" className="eyebrow">Password</label>
        <input id="ap" className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary big" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}

/** Checks who you are before showing anything. Not signed in: the sign-in form. Signed in but not an admin: sent home. */
export default function AdminPage() {
  const { ready, session } = useAuth();
  if (!ready) return <div className="pg-narrow"><p className="muted">Checking access…</p></div>;
  if (!session) return <AdminSignIn />;
  return <Admin />;
}

function Admin() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { say, toast } = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<"groups" | "people" | "therapists" | "reports">("groups");
  const [edit, setEdit] = useState<Room | null>(null);

  const call: Call = useCallback(async (action, body = {}) => {
    const r = await authPost<Record<string, unknown>>("/api/admin", { action, ...body });
    if (r.status === 403) setDenied(true);
    return { ok: r.ok, data: r.data };
  }, []);

  const load = useCallback(async () => {
    const r = await call("overview");
    if (r.ok) setData(r.data as unknown as Overview);
  }, [call]);
  useEffect(() => { load(); }, [load]);
  // Not an admin: leave straight away, without showing anything.
  useEffect(() => { if (denied) router.replace("/"); }, [denied, router]);

  if (denied || !data) return <div className="pg-narrow"><p className="muted">Checking access…</p></div>;

  return (
    <div className="pg-wide adm">
      {toast}
      <div className="topbar">
        <Link className="wordmark display" href="/">Therapia <small className="muted">admin</small></Link>
        <span className="row"><Link className="btn ghost sm" href="/dashboard">App</Link><button className="btn ghost sm" onClick={() => signOut()}>Sign out</button></span>
      </div>
      <div className="seg" role="tablist" aria-label="Admin sections">
        {([["groups", "Groups"], ["people", "Facilitators"], ["therapists", "Therapists"], ["reports", "Reports"]] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => { setTab(k); setEdit(null); }}>{l}</button>
        ))}
      </div>
      {tab === "groups" && (edit
        ? <GroupEditor key={edit.id || "new"} start={edit} data={data} call={call} say={say} onClose={() => setEdit(null)} onChanged={load} />
        : <GroupList data={data} onEdit={setEdit} />)}
      {tab === "people" && <Facilitators data={data} call={call} say={say} onChanged={load} />}
      {tab === "therapists" && <Therapists call={call} say={say} />}
      {tab === "reports" && <Reports data={data} call={call} say={say} />}
    </div>
  );
}

function GroupList({ data, onEdit }: { data: Overview; onEdit: (r: Room) => void }) {
  const code = (id: string) => data.codes.find((c) => c.room_id === id);
  return (
    <section className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 className="display ptitle" style={{ fontSize: 24, margin: 0 }}>Groups ({data.rooms.length})</h1>
        <button className="btn accent sm" onClick={() => onEdit(BLANK)}>+ New group</button>
      </div>
      <div className="adm-grid">
        {data.rooms.map((r) => {
          const c = data.counts[r.id];
          const next = data.sessions.find((s) => s.room_id === r.id);
          return (
            <article className={`card adm-card pal-${r.pal}`} key={r.id}>
              <div className="rc-cat">{r.cat}</div>
              <h2 className="display" style={{ fontSize: 19, margin: "2px 0" }}>{r.title}</h2>
              <div className="rc-host">{r.host_id ? r.host_name : <b className="warn">No facilitator yet</b>}</div>
              <div className="fine">{next ? `Next: ${fmtLagos(next.starts_at)}` : r.schedule_text || "No time set"}</div>
              <div className="rc-meta" style={{ margin: "8px 0" }}>
                {!r.active && <span className="badge">Hidden</span>}
                {r.women_only && <span className="badge hib">Women only</span>}
                {r.men_only && <span className="badge">Men only</span>}
                {code(r.id) && <span className="badge">Password on</span>}
                <span className="fine">{c?.members ?? 0} members{c?.banned ? ` · ${c.banned} banned` : ""}</span>
              </div>
              <button className="btn soft sm" onClick={() => onEdit(r)}>Edit group</button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function GroupEditor({ start, data, call, say, onClose, onChanged }: { start: Room; data: Overview; call: Call; say: (m: string) => void; onClose: () => void; onChanged: () => Promise<void> }) {
  const isNew = !start.id;
  const [f, setF] = useState<Room>(start);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Room>(k: K, v: Room[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    const r = await call("group.save", { ...f, id: isNew ? undefined : f.id });
    setBusy(false);
    if (!r.ok) { say(String(r.data.error ?? "Couldn't save.")); return; }
    say(isNew ? "Group created." : "Saved.");
    await onChanged();
    if (isNew) onClose();
  }
  async function remove() {
    if (!window.confirm(`Delete "${f.title}" for good? Its chat, members and sessions are deleted too. To just hide it, untick "Visible" instead.`)) return;
    const r = await call("group.delete", { id: f.id });
    if (!r.ok) { say("Couldn't delete."); return; }
    await onChanged(); onClose();
  }

  return (
    <section className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 className="display ptitle" style={{ fontSize: 24, margin: 0 }}>{isNew ? "New group" : "Edit group"}</h1>
        <button className="btn ghost sm" onClick={onClose}>← All groups</button>
      </div>

      <div className="card stack">
        <label className="stack"><span className="eyebrow">Group name</span><input className="field" value={f.title} maxLength={60} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Grief Support Circle" /></label>
        <label className="stack"><span className="eyebrow">Topic</span><input className="field" value={f.cat} maxLength={30} onChange={(e) => set("cat", e.target.value)} placeholder="e.g. Grief" /></label>
        <label className="stack"><span className="eyebrow">Facilitator (host)</span>
          <select className="field" value={f.host_id ?? ""} onChange={(e) => set("host_id", e.target.value || null)}>
            <option value="">No facilitator yet</option>
            {data.facilitators.map((x) => <option key={x.user_id} value={x.user_id}>{x.display_name || x.username}</option>)}
          </select>
        </label>
        <div className="stack"><span className="eyebrow">Weekly schedule (Nigeria time)</span>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <button key={d} type="button" className={`btn sm ${f.days.includes(i) ? "primary" : "ghost"}`} aria-pressed={f.days.includes(i)}
                onClick={() => set("days", f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i].sort())}>{d}</button>
            ))}
          </div>
          <input className="field" type="time" style={{ maxWidth: 160 }} value={f.start_time ?? ""} onChange={(e) => set("start_time", e.target.value)} aria-label="Start time" />
          <p className="fine">Members get a reminder about 15 minutes before each of these times (and before any dated session below). Leave all days off for groups that only meet on dated sessions.</p>
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 16 }}>
          <label className="check"><input type="checkbox" checked={f.women_only} onChange={(e) => setF((x) => ({ ...x, women_only: e.target.checked, men_only: e.target.checked ? false : x.men_only }))} />Women only (always needs a password)</label>
          <label className="check"><input type="checkbox" checked={f.men_only} onChange={(e) => setF((x) => ({ ...x, men_only: e.target.checked, women_only: e.target.checked ? false : x.women_only }))} />Men only</label>
          <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} />Visible to members</label>
        </div>
        <div><span className="eyebrow">Colour</span>
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            {PALS.map((p) => <button key={p} type="button" aria-label={`Colour ${p}`} aria-pressed={f.pal === p} onClick={() => set("pal", p)} className={`swatch ankara pal-${p}`} />)}
          </div>
        </div>
        <button className="btn primary big" disabled={busy} onClick={save}>{busy ? "Saving…" : isNew ? "Create group" : "Save changes"}</button>
        {f.men_only && <p className="fine">Men-only is a label for now. Only women-only groups are locked by the system, so give a men-only group a password if you want it closed.</p>}
      </div>

      {!isNew && <>
        <Password room={f} code={data.codes.find((c) => c.room_id === f.id)} call={call} say={say} onChanged={onChanged} />
        <Sessions room={f} sessions={data.sessions.filter((s) => s.room_id === f.id)} call={call} say={say} onChanged={onChanged} />
        <Members room={f} call={call} say={say} onChanged={onChanged} />
        <div className="card"><button className="btn ghost" onClick={remove}>Delete this group</button></div>
      </>}
      {isNew && <p className="fine">After you create the group you can set its password, add dated sessions and manage members.</p>}
    </section>
  );
}

function Password({ room, code, call, say, onChanged }: { room: Room; code?: Code; call: Call; say: (m: string) => void; onChanged: () => Promise<void> }) {
  const [pw, setPw] = useState("");
  const [days, setDays] = useState("30");
  async function set() {
    const r = await call("code.set", { room_id: room.id, code: pw, days: Number(days) });
    if (!r.ok) { say(String(r.data.error ?? "Couldn't set it.")); return; }
    setPw(""); say("Password set."); onChanged();
  }
  async function clear() {
    const r = await call("code.clear", { room_id: room.id });
    if (!r.ok) { say("Couldn't remove it."); return; }
    say("Password removed."); onChanged();
  }
  return (
    <div className="card stack">
      <h2 className="sec-h display" style={{ margin: 0 }}>Group password</h2>
      <p className="muted">{code ? `A password is on${code.expires_at ? `, expires ${fmtLagos(code.expires_at)}` : ", it does not expire"}.` : room.women_only ? "No password is set. Nobody can join this women-only group until you set one." : "No password. Anyone signed in can join."} Members enter it once when they join. The password itself is never shown again, only replaced.</p>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <input className="field" style={{ flex: "1 1 180px" }} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (4+ characters)" autoComplete="off" aria-label="New group password" />
        <select className="field" style={{ flex: "0 0 200px" }} value={days} onChange={(e) => setDays(e.target.value)} aria-label="Expires">
          <option value="7">Expires in 7 days</option><option value="30">Expires in 30 days</option><option value="90">Expires in 90 days</option><option value="0">Never expires</option>
        </select>
        <button className="btn primary" disabled={pw.trim().length < 4} onClick={set}>{code ? "Replace password" : "Set password"}</button>
        {code && <button className="btn ghost" onClick={clear}>Remove password</button>}
      </div>
    </div>
  );
}

function Sessions({ room, sessions, call, say, onChanged }: { room: Room; sessions: Sess[]; call: Call; say: (m: string) => void; onChanged: () => Promise<void> }) {
  const [at, setAt] = useState("");
  const [note, setNote] = useState("");
  async function add() {
    // The time is entered as Nigeria time (WAT, UTC+1)
    const r = await call("session.add", { room_id: room.id, starts_at: new Date(`${at}:00+01:00`).toISOString(), note });
    if (!r.ok) { say(String(r.data.error ?? "Couldn't add.")); return; }
    setAt(""); setNote(""); say("Session added."); onChanged();
  }
  async function del(id: string) { await call("session.delete", { id }); onChanged(); }
  return (
    <div className="card stack">
      <h2 className="sec-h display" style={{ margin: 0 }}>Dated sessions</h2>
      <p className="muted">Members see the next session on the group. Times are Nigeria time (WAT).</p>
      {sessions.length === 0 && <p className="fine">No upcoming sessions.</p>}
      {sessions.map((s) => (
        <div className="row adm-line" key={s.id}><span><b>{fmtLagos(s.starts_at)}</b>{s.note ? ` · ${s.note}` : ""}</span><button className="btn ghost sm" onClick={() => del(s.id)}>Remove</button></div>
      ))}
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <input className="field" style={{ flex: "0 0 220px" }} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} aria-label="Session date and time" />
        <input className="field" style={{ flex: "1 1 160px" }} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />
        <button className="btn primary" disabled={!at} onClick={add}>Add session</button>
      </div>
    </div>
  );
}

function Members({ room, call, say, onChanged }: { room: Room; call: Call; say: (m: string) => void; onChanged: () => Promise<void> }) {
  const [list, setList] = useState<Mem[] | null>(null);
  const [q, setQ] = useState("");
  const load = useCallback(async () => { const r = await call("members.list", { room_id: room.id }); setList((r.data.members as Mem[]) ?? []); }, [call, room.id]);
  useEffect(() => { load(); }, [load]);
  async function ban(m: Mem, banned: boolean) {
    if (banned && !window.confirm(`Ban "${m.handle}" from this group? Their messages here are deleted and they are removed from the audio room.`)) return;
    const r = await call("member.ban", { room_id: room.id, alias: m.alias, banned });
    if (!r.ok) { say("Couldn't update."); return; }
    say(banned ? "Banned." : "Ban lifted."); load(); onChanged();
  }
  const shown = (list ?? []).filter((m) => m.handle.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="card stack">
      <h2 className="sec-h display" style={{ margin: 0 }}>Members ({list?.length ?? "…"})</h2>
      <p className="muted">Members appear by the name they use in this group. Accounts behind those names are not shown.</p>
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a name" aria-label="Search members" />
      {list && shown.length === 0 && <p className="fine">No members found.</p>}
      <div className="adm-scroll">
        {shown.map((m) => (
          <div className="row adm-line" key={m.alias}>
            <span><b>{m.handle}</b> <span className="fine">joined {fmtLagos(m.joined_at)}</span>{m.banned && <span className="badge"> Banned</span>}</span>
            <button className="btn ghost sm" onClick={() => ban(m, !m.banned)}>{m.banned ? "Lift ban" : "Ban"}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Facilitators({ data, call, say, onChanged }: { data: Overview; call: Call; say: (m: string) => void; onChanged: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [user, setUser] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const r = await call("facilitator.create", { display_name: name, username: user, password: pw });
    setBusy(false);
    if (!r.ok) { say(String(r.data.error ?? "Couldn't add.")); return; }
    setName(""); setUser(""); setPw(""); say("Facilitator added."); onChanged();
  }
  return (
    <section className="stack">
      <h1 className="display ptitle" style={{ fontSize: 24, margin: 0 }}>Facilitators ({data.facilitators.length})</h1>
      <form className="card stack" onSubmit={add}>
        <span className="eyebrow">Add a facilitator</span>
        <input className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Display name, e.g. Dr Halima" aria-label="Display name" />
        <input className="field" value={user} maxLength={20} onChange={(e) => setUser(e.target.value)} placeholder="Sign-in username, e.g. dr_halima" autoCapitalize="none" autoComplete="off" aria-label="Sign-in username" />
        <input className="field" type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Starting password (8+ characters)" autoComplete="off" aria-label="Starting password" />
        <button className="btn primary" disabled={busy || name.trim().length < 2 || user.trim().length < 3 || pw.length < 8}>{busy ? "Adding…" : "Add facilitator"}</button>
        <p className="fine">They sign in at /host/login with the username and password. Then assign them to a group from the Groups tab.</p>
      </form>
      {data.facilitators.map((f) => <FacRow key={f.user_id} fac={f} rooms={data.rooms.filter((r) => r.host_id === f.user_id)} call={call} say={say} onChanged={onChanged} />)}
    </section>
  );
}

function FacRow({ fac, rooms, call, say, onChanged }: { fac: Fac; rooms: Room[]; call: Call; say: (m: string) => void; onChanged: () => Promise<void> }) {
  const [name, setName] = useState(fac.display_name ?? "");
  const [pw, setPw] = useState("");
  async function save() {
    const r = await call("facilitator.update", { user_id: fac.user_id, display_name: name, ...(pw ? { password: pw } : {}) });
    if (!r.ok) { say(String(r.data.error ?? "Couldn't save.")); return; }
    setPw(""); say("Saved."); onChanged();
  }
  async function del() {
    if (!window.confirm(`Delete ${fac.display_name || fac.username}? Their groups will show "To be assigned".`)) return;
    const r = await call("facilitator.delete", { user_id: fac.user_id });
    if (!r.ok) { say("Couldn't delete."); return; }
    say("Facilitator deleted."); onChanged();
  }
  return (
    <div className="card stack">
      <div><b>{fac.display_name || fac.username}</b> <span className="fine">@{fac.username}</span></div>
      <div className="fine">{rooms.length ? `Hosts: ${rooms.map((r) => r.title).join(", ")}` : "Not assigned to any group yet"}</div>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <input className="field" style={{ flex: "1 1 160px" }} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="Display name" />
        <input className="field" style={{ flex: "1 1 160px" }} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (optional)" autoComplete="off" aria-label="New password" />
        <button className="btn primary" disabled={name.trim().length < 2 || (pw.length > 0 && pw.length < 8)} onClick={save}>Save</button>
        <button className="btn ghost" onClick={del}>Delete</button>
      </div>
    </div>
  );
}

function Reports({ data, call, say }: { data: Overview; call: Call; say: (m: string) => void }) {
  const [list, setList] = useState<Rep[] | null>(null);
  const load = useCallback(async () => { const r = await call("reports.list"); setList((r.data.reports as Rep[]) ?? []); }, [call]);
  useEffect(() => { load(); }, [load]);
  async function resolve(id: string, resolution: string) {
    const r = await call("report.resolve", { id, resolution });
    if (!r.ok) { say("Couldn't resolve that report."); return; }
    say("Done."); load();
  }
  const title = (id: string) => data.rooms.find((r) => r.id === id)?.title ?? id;
  return (
    <section className="stack">
      <h1 className="display ptitle" style={{ fontSize: 24, margin: 0 }}>Open reports</h1>
      {list && list.length === 0 && <p className="muted">No open reports. 🎉</p>}
      {(list ?? []).map((r) => (
        <div className="card stack" key={r.id}>
          <div className="fine">{title(r.room_id)} · {r.vent_id ? "Vent · " : ""}{fmtLagos(r.created_at)}</div>
          {r.body_snapshot && <blockquote className="adm-quote">{r.body_snapshot}</blockquote>}
          {r.reason && <p className="muted">Reason: {r.reason}</p>}
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <button className="btn soft sm" onClick={() => resolve(r.id, "delete_message")}>Delete message</button>
            <button className="btn soft sm" onClick={() => resolve(r.id, "block")}>Ban from group</button>
            <button className="btn ghost sm" onClick={() => resolve(r.id, "dismiss")}>Dismiss</button>
          </div>
        </div>
      ))}
    </section>
  );
}
