import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { respond } from "@/lib/mascot";
import { isQuestion } from "@/lib/mascot-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called every minute by the database scheduler. Finds questions that have waited 5 minutes without any reply
 * and lets the mascot answer them. Each message is answered at most once, and there are hourly and daily caps,
 * so calling this too often costs nothing extra.
 */
export async function POST() {
  const db = adminClient();
  if (!db) return NextResponse.json({ status: "unavailable" });
  const ok = await db.rpc("rate_allow", { p_key: "mascot:sweep", p_max: 120, p_window_secs: 3600 });
  if (ok.data === false) return NextResponse.json({ status: "limited" });

  const from = new Date(Date.now() - 60 * 60_000).toISOString();
  const to = new Date(Date.now() - 5 * 60_000).toISOString();
  const q = await db.from("messages").select("id,alias,body,room_id").eq("is_ai", false).ilike("body", "%?%").gte("created_at", from).lte("created_at", to).order("id").limit(40);
  let handled = 0;
  for (const m of (q.data ?? []) as { id: number; alias: string; body: string; room_id: string }[]) {
    if (handled >= 3) break;
    if (!isQuestion(m.body)) continue;
    const job = await db.from("mascot_jobs").select("message_id").eq("message_id", m.id).maybeSingle();
    if (job.data) continue;
    // Answered means someone else wrote in the group after it.
    const later = await db.from("messages").select("*", { count: "exact", head: true }).eq("room_id", m.room_id).gt("id", m.id).neq("alias", m.alias);
    if ((later.count ?? 0) > 0) continue;
    const r = await respond(db, m.room_id, m, "unanswered");
    if (r === "posted") handled++;
  }
  return NextResponse.json({ status: "ok", handled });
}
