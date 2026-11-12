import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { isAlone, respond, type Trigger } from "@/lib/mascot";
import { isQuestion, TAG_RE } from "@/lib/mascot-shared";
import { bearer, ROOM_ID } from "@/lib/server";
import { userClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

/**
 * Called by the chat right after a member sends a message. The mascot answers when
 * (1) it was tagged, or (2) the sender asked a question and nobody else is around.
 * The server re-checks everything: who sent it, whether it was tagged, and whether the group is really quiet.
 */
export async function POST(req: Request) {
  const jwt = bearer(req);
  if (!jwt) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  let roomId = "", messageId = 0;
  try { const b = await req.json(); roomId = String(b.roomId ?? ""); messageId = Number(b.messageId); } catch { /* below */ }
  if (!ROOM_ID.test(roomId) || !Number.isInteger(messageId) || messageId <= 0) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const me = userClient(jwt);
  const u = await me.auth.getUser(jwt);
  if (u.error || !u.data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const ok = await me.rpc("rate_allow_me", { p_action: "mascot", p_max: 12, p_window_secs: 600 });
  if (ok.data === false) return NextResponse.json({ status: "limited" }, { status: 429 });
  const acc = await me.rpc("room_access", { p_room: roomId });
  if (!acc.data?.ok) return NextResponse.json({ error: "Join the group first." }, { status: 403 });

  const db = adminClient();
  if (!db) return NextResponse.json({ status: "unavailable" });

  const m = await db.from("messages").select("id,alias,body,room_id,is_ai").eq("id", messageId).eq("room_id", roomId).maybeSingle();
  if (!m.data || m.data.is_ai) return NextResponse.json({ status: "ignored" });
  // The message must be the caller's own (a normal message, or one of their anonymous ones).
  let mine = m.data.alias === acc.data.alias;
  if (!mine) {
    const an = await db.from("anon_messages").select("real_alias").eq("message_id", messageId).maybeSingle();
    mine = an.data?.real_alias === acc.data.alias;
  }
  if (!mine) return NextResponse.json({ status: "ignored" });

  let trigger: Trigger | null = null;
  if (TAG_RE.test(m.data.body)) trigger = "tag";
  else if (isQuestion(m.data.body) && (await isAlone(db, roomId, acc.data.alias, messageId))) trigger = "alone";
  if (!trigger) return NextResponse.json({ status: "ignored" });

  const result = await respond(db, roomId, m.data, trigger);
  return NextResponse.json({ status: result });
}
