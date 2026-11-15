import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Cron-job.org (or any scheduler) calls our URLs with ?key=<CRON_SECRET> or "Authorization: Bearer <CRON_SECRET>". */
export function cronAllowed(req: Request): "ok" | "off" | "denied" {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return "off";
  const got = new URL(req.url).searchParams.get("key") ?? (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "denied";
}
