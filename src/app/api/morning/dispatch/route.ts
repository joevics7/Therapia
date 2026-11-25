import * as webpush from "web-push";
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called every 15 minutes by the database scheduler when someone's morning message is due. Sends today's message to every
 * device of each person who turned it on, once a day.
 */
export async function POST() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  const db = adminClient();
  if (!pub || !priv || !db) return NextResponse.json({ status: "unavailable" });
  const limit = await db.rpc("rate_allow", { p_key: "morning:dispatch", p_max: 40, p_window_secs: 3600 });
  if (limit.data === false) return NextResponse.json({ status: "limited" });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://www.theraping.app", pub, priv);

  const due = await db.rpc("due_morning");
  const rows = (due.data ?? []) as { user_id: string; local_day: string }[];
  let sent = 0, failed = 0;
  for (const d of rows) {
    // Mark it done first, so a slow run can never send twice.
    const mark = await db.from("morning_prefs").update({ last_sent: d.local_day }).eq("user_id", d.user_id);
    if (mark.error) continue;
    const msg = await db.rpc("motivation_for", { p_user: d.user_id }); // matches what this person said they need help with
    const body = typeof msg.data === "string" ? msg.data : "";
    if (!body) continue; // nothing suitable today
    const subs = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", d.user_id);
    const payload = JSON.stringify({ title: "Good morning", body, url: "/dashboard", tag: "morning" });
    for (const s of (subs.data ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[]) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600 });
        sent++;
      } catch (e) {
        failed++;
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
      }
    }
  }
  return NextResponse.json({ status: "ok", due: rows.length, sent, failed });
}
