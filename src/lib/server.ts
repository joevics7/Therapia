import { timingSafeEqual } from "node:crypto";

// All LiveKit settings come from env. Switching Cloud <-> self-hosted is only a change of values.
export function livekitEnv() {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) return null;
  return { url, key, secret, httpUrl: url.replace(/^wss:/, "https:").replace(/^ws:/, "http:") };
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function isHostKey(candidate: unknown): boolean {
  const real = process.env.HOST_KEY;
  return !!real && typeof candidate === "string" && candidate.length > 0 && safeEqual(candidate, real);
}

export function cleanHandle(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  const t = s.replace(/[^\p{L}\p{N} ]/gu, "").trim().slice(0, 32);
  return t || "Guest";
}
