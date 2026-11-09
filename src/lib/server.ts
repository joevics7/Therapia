// All LiveKit settings come from env. Switching Cloud <-> self-hosted is only a change of values.
export function livekitEnv() {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) return null;
  return { url, key, secret, httpUrl: url.replace(/^wss:/, "https:").replace(/^ws:/, "http:") };
}

export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

export const ROOM_ID = /^[a-z0-9-]{2,40}$/;

import { createHmac } from "crypto";

/**
 * A key for "this network connection" used only for rate limits. The raw IP address is never stored:
 * it is hashed with a server secret first.
 */
export function clientKey(req: Request): string {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY || "therapia";
  return createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32);
}

/**
 * Keyed hash of the two answers (order does not matter). Used only to find a forgotten username.
 * The key stays on the app server and never reaches the database.
 */
export function lookupKey(a1: string, a2: string): string {
  const pepper = process.env.RECOVERY_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || "therapia";
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const joined = [norm(a1), norm(a2)].sort().join("\u0000");
  return createHmac("sha256", pepper).update(joined).digest("hex");
}
