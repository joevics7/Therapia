"use client";
import { authPost } from "./api";
import { supabase } from "./supabase";

export type PushState = "unsupported" | "needs-install" | "not-configured" | "denied" | "ready";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function b64ToBytes(s: string) {
  const p = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Can this device get browser notifications, and if not, why? */
export function pushState(): PushState {
  if (typeof window === "undefined") return "unsupported";
  if (!KEY) return "not-configured";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return ios && !standalone ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ready";
}

export const pushMessage: Record<Exclude<PushState, "ready">, string> = {
  unsupported: "This browser can't show notifications. Try Chrome or Firefox, or add Therapia to your home screen.",
  "needs-install": "On iPhone, tap Share, then Add to Home Screen, open Therapia from there, and try again.",
  "not-configured": "Reminders aren't switched on for this site yet.",
  denied: "Notifications are blocked. Allow them for this site in your browser settings, then try again.",
};

/** Asks permission if needed and registers this device for reminders. Returns true when it worked. */
export async function enablePush(): Promise<boolean> {
  if (pushState() !== "ready") return false;
  const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (perm !== "granted") return false;
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(KEY!) }));
  const j = sub.toJSON();
  const r = await authPost("/api/push/subscribe", { endpoint: j.endpoint, keys: j.keys });
  return r.ok;
}

/** True when this device is already registered. */
export async function pushActive(): Promise<boolean> {
  try {
    if (pushState() !== "ready" || Notification.permission !== "granted") return false;
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    return !!(await reg?.pushManager.getSubscription());
  } catch { return false; }
}

/** Stops notifications on this device. */
export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const token = (await supabase().auth.getSession()).data.session?.access_token;
    if (token) await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    await sub.unsubscribe();
  } catch { /* nothing to undo */ }
}
