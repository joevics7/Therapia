import { RoomServiceClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { emailFor, passwordProblem, usernameProblem } from "@/lib/identity";
import { bearer, livekitEnv, ROOM_ID } from "@/lib/server";
import { userClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const J = (body: object, status = 200) => NextResponse.json(body, { status });
const bad = (message: string, status = 400) => J({ error: message }, status);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PALS = ["a", "b", "c", "d", "e"];

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "group";

/**
 * Every admin action goes through here. The caller must be signed in AND the database must say they are an admin
 * (profiles.role = 'admin'). The checks run on the server on every request, so hiding the page is only a courtesy.
 */
export async function POST(req: Request) {
  const jwt = bearer(req);
  if (!jwt) return bad("Sign in first.", 401);
  const me = userClient(jwt);
  const who = await me.auth.getUser(jwt);
  if (who.error || !who.data.user) return bad("Sign in first.", 401);
  const isAdmin = await me.rpc("is_admin");
  if (isAdmin.data !== true) return bad("Not allowed.", 403);
  const limit = await me.rpc("rate_allow_me", { p_action: "admin", p_max: 240, p_window_secs: 60 });
  if (limit.data === false) return bad("Slow down a little.", 429);

  const db = adminClient();
  if (!db) return bad("The server is missing SUPABASE_SERVICE_ROLE_KEY.", 503);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return bad("Bad request."); }
  const action = str(b.action, 40);

  try {
    switch (action) {
      // ---------- read everything the screen needs ----------
      case "overview": {
        const [rooms, profs, codes, sess] = await Promise.all([
          db.from("rooms").select("id,title,cat,host_name,host_id,women_only,men_only,pal,schedule_text,active,created_at").order("created_at"),
          db.from("profiles").select("user_id,username,display_name").eq("role", "facilitator").order("created_at"),
          db.from("room_codes").select("room_id,expires_at,updated_at"),
          db.from("sessions").select("id,room_id,starts_at,note").gte("starts_at", new Date(Date.now() - 3600_000).toISOString()).order("starts_at"),
        ]);
        const list = rooms.data ?? [];
        const counts = await Promise.all(list.map(async (r) => {
          const [all, banned] = await Promise.all([
            db.from("room_members").select("*", { count: "exact", head: true }).eq("room_id", r.id),
            db.from("room_members").select("*", { count: "exact", head: true }).eq("room_id", r.id).eq("banned", true),
          ]);
          return [r.id, { members: all.count ?? 0, banned: banned.count ?? 0 }] as const;
        }));
        return J({ rooms: list, facilitators: profs.data ?? [], codes: codes.data ?? [], sessions: sess.data ?? [], counts: Object.fromEntries(counts) });
      }

      // ---------- facilitators ----------
      case "facilitator.create": {
        const username = str(b.username, 20), password = typeof b.password === "string" ? b.password : "", name = str(b.display_name, 40);
        const problem = usernameProblem(username) || passwordProblem(password) || (name.length < 2 ? "Enter the facilitator's display name." : null);
        if (problem) return bad(problem);
        const taken = await db.from("profiles").select("user_id").ilike("username", username).maybeSingle();
        if (taken.data) return bad("That username is taken.", 409);
        const made = await db.auth.admin.createUser({ email: emailFor(username), password, email_confirm: true, user_metadata: { username } });
        if (made.error || !made.data.user) return bad("Couldn't create that account.", 500);
        const id = made.data.user.id;
        const up = await db.from("profiles").update({ username, role: "facilitator", display_name: name }).eq("user_id", id);
        if (up.error) { await db.auth.admin.deleteUser(id); return bad("Couldn't create that account.", 500); }
        return J({ ok: true, id });
      }
      case "facilitator.update": {
        const id = str(b.user_id, 40);
        if (!UUID.test(id)) return bad("Bad request.");
        const t = await db.from("profiles").select("role").eq("user_id", id).maybeSingle();
        if (t.data?.role !== "facilitator") return bad("Facilitator not found.", 404);
        const name = b.display_name === undefined ? null : str(b.display_name, 40);
        if (name !== null) {
          if (name.length < 2) return bad("Enter the facilitator's display name.");
          const u = await db.from("profiles").update({ display_name: name }).eq("user_id", id);
          if (u.error) return bad("Couldn't save.", 500);
          await db.from("rooms").update({ host_name: name }).eq("host_id", id); // groups show the new name
        }
        if (typeof b.password === "string" && b.password) {
          const p = passwordProblem(b.password);
          if (p) return bad(p);
          const r = await db.auth.admin.updateUserById(id, { password: b.password });
          if (r.error) return bad("Couldn't change the password.", 500);
        }
        return J({ ok: true });
      }
      case "facilitator.delete": {
        const id = str(b.user_id, 40);
        if (!UUID.test(id)) return bad("Bad request.");
        const t = await db.from("profiles").select("role").eq("user_id", id).maybeSingle();
        if (t.data?.role !== "facilitator") return bad("Facilitator not found.", 404);
        await db.from("rooms").update({ host_id: null, host_name: "To be assigned" }).eq("host_id", id);
        const d = await db.auth.admin.deleteUser(id);
        if (d.error) return bad("Couldn't delete.", 500);
        return J({ ok: true });
      }

      // ---------- groups ----------
      case "group.save": {
        const id = str(b.id, 40);
        const title = str(b.title, 60), cat = str(b.cat, 30), schedule = str(b.schedule_text, 60);
        const pal = str(b.pal, 1) || "a";
        if (title.length < 3) return bad("Give the group a name (at least 3 letters).");
        if (cat.length < 2) return bad("Add a topic, such as Grief or Betting.");
        if (!PALS.includes(pal)) return bad("Bad colour.");
        const women = b.women_only === true, men = b.men_only === true;
        if (women && men) return bad("A group can't be both women-only and men-only.");
        let hostId: string | null = null, hostName = "To be assigned";
        if (b.host_id) {
          const hid = str(b.host_id, 40);
          const f = UUID.test(hid) ? await db.from("profiles").select("display_name,username,role").eq("user_id", hid).maybeSingle() : null;
          if (!f?.data || f.data.role !== "facilitator") return bad("Pick a facilitator from the list.");
          hostId = hid; hostName = f.data.display_name || f.data.username || "Facilitator";
        }
        const fields = { title, cat, schedule_text: schedule, pal, women_only: women, men_only: men, host_id: hostId, host_name: hostName, active: b.active !== false };
        if (id) {
          if (!ROOM_ID.test(id)) return bad("Bad request.");
          const u = await db.from("rooms").update(fields).eq("id", id).select("id").maybeSingle();
          if (u.error || !u.data) return bad("Couldn't save the group.", 500);
          return J({ ok: true, id });
        }
        let newId = slug(title), n = 2;
        while ((await db.from("rooms").select("id").eq("id", newId).maybeSingle()).data) newId = `${slug(title).slice(0, 26)}-${n++}`;
        const c = await db.from("rooms").insert({ id: newId, ...fields }).select("id").single();
        if (c.error) return bad("Couldn't create the group.", 500);
        return J({ ok: true, id: newId });
      }
      case "group.delete": {
        const id = str(b.id, 40);
        if (!ROOM_ID.test(id)) return bad("Bad request.");
        const lk = livekitEnv();
        if (lk) { try { await new RoomServiceClient(lk.httpUrl, lk.key, lk.secret).deleteRoom(id); } catch { /* nobody was in it */ } }
        const d = await db.from("rooms").delete().eq("id", id);
        if (d.error) return bad("Couldn't delete.", 500);
        return J({ ok: true });
      }

      // ---------- group password ----------
      case "code.set": {
        const id = str(b.room_id, 40), code = str(b.code, 40);
        if (!ROOM_ID.test(id)) return bad("Bad request.");
        if (code.length < 4) return bad("Use a password of at least 4 characters.");
        const days = typeof b.days === "number" && b.days > 0 ? Math.min(Math.floor(b.days), 365) : 0;
        const r = await me.rpc("set_room_code", { p_room: id, p_code: code, p_days: days });
        if (r.error) return bad("Couldn't set the password.", 500);
        return J({ ok: true });
      }
      case "code.clear": {
        const id = str(b.room_id, 40);
        if (!ROOM_ID.test(id)) return bad("Bad request.");
        const r = await db.from("room_codes").delete().eq("room_id", id);
        if (r.error) return bad("Couldn't remove the password.", 500);
        return J({ ok: true });
      }

      // ---------- dated sessions ----------
      case "session.add": {
        const id = str(b.room_id, 40), at = new Date(str(b.starts_at, 40));
        if (!ROOM_ID.test(id) || Number.isNaN(at.getTime())) return bad("Pick a valid date and time.");
        const r = await db.from("sessions").insert({ room_id: id, starts_at: at.toISOString(), note: str(b.note, 200) || null });
        if (r.error) return bad("Couldn't add that session.", 500);
        return J({ ok: true });
      }
      case "session.delete": {
        const id = str(b.id, 40);
        if (!UUID.test(id)) return bad("Bad request.");
        await db.from("sessions").delete().eq("id", id);
        return J({ ok: true });
      }

      // ---------- members ----------
      case "members.list": {
        const id = str(b.room_id, 40);
        if (!ROOM_ID.test(id)) return bad("Bad request.");
        // Only the group name and alias are shown. Account ids and usernames behind a name are never sent to the screen.
        const r = await db.from("room_members").select("alias,handle,banned,joined_at").eq("room_id", id).order("joined_at", { ascending: false }).limit(500);
        return J({ members: r.data ?? [] });
      }
      case "member.ban": {
        const id = str(b.room_id, 40), alias = str(b.alias, 40), banned = b.banned !== false;
        if (!ROOM_ID.test(id) || !UUID.test(alias)) return bad("Bad request.");
        const u = await db.from("room_members").update({ banned }).eq("room_id", id).eq("alias", alias);
        if (u.error) return bad("Couldn't update.", 500);
        if (banned) {
          await db.from("messages").delete().eq("room_id", id).eq("alias", alias);
          const lk = livekitEnv();
          if (lk) { try { await new RoomServiceClient(lk.httpUrl, lk.key, lk.secret).removeParticipant(id, alias); } catch { /* not in the audio room */ } }
        }
        return J({ ok: true });
      }

      // ---------- reports ----------
      case "reports.list": {
        const r = await db.from("reports").select("id,room_id,reason,body_snapshot,created_at").eq("status", "open").order("created_at", { ascending: false }).limit(100);
        return J({ reports: r.data ?? [] });
      }
      case "report.resolve": {
        const id = str(b.id, 40), act = str(b.resolution, 20);
        if (!UUID.test(id) || !["dismiss", "delete_message", "block"].includes(act)) return bad("Bad request.");
        const r = await me.rpc("resolve_report", { p_report: id, p_action: act });
        if (r.error) return bad("Couldn't resolve that report.", 500);
        return J({ ok: true });
      }
      default:
        return bad("Unknown action.");
    }
  } catch {
    return bad("Something went wrong. Try again.", 500);
  }
}
