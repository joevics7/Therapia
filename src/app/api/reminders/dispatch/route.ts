import * as webpush from "web-push";
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called every 5 minutes by the database scheduler when a reminder is due. Sends a browser notification to every device
 * of each person who asked to be reminded, once per session. The text is deliberately plain: it never names the group,
 * because a notification can be read by anyone looking at the person's lock screen.
 */
export async function POST() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  const db = adminClient();
  if (!pub || !priv || !db) return NextResponse.json({ status: "unavailable" });
  const limit = await db.rpc("rate_allow", { p_key: "reminders:dispatch", p_max: 60, p_window_secs: 3600 });
  if (limit.data === false) return NextResponse.json({ status: "limited" });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@therapia.invalid", pub, priv);

  const due = await db.rpc("due_reminders");
  const rows = (due.data ?? []) as { user_id: string; room_id: string; starts_at: string }[];
  let sent = 0, failed = 0;
  for (const d of rows) {
    const subs = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", d.user_id);
    const list = (subs.data ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[];
    // Mark it done first, so a slow run can never send twice. People with no device simply have nothing to receive.
    const mark = await db.from("reminder_log").insert({ user_id: d.user_id, room_id: d.room_id, starts_at: d.starts_at });
    if (mark.error) continue;
    const minutes = Math.max(1, Math.round((new Date(d.starts_at).getTime() - Date.now()) / 60000));
    const payload = JSON.stringify({ title: "Therapia", body: `Your group starts in about ${minutes} minute${minutes === 1 ? "" : "s"}.`, url: `/room/${d.room_id}`, tag: `r-${d.room_id}` });
    for (const s of list) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 900, urgency: "high" });
        sent++;
      } catch (e) {
        failed++;
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id); // the device unsubscribed
      }
    }
  }
  return NextResponse.json({ status: "ok", due: rows.length, sent, failed });
}
