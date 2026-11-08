"use client";
import { supabase } from "./supabase";

/** POST JSON to our own API with the signed-in user's token attached. */
export async function authPost<T = Record<string, unknown>>(url: string, body: unknown) {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  let json = {} as T;
  try { json = (await res.json()) as T; } catch { /* empty body */ }
  return { ok: res.ok, status: res.status, data: json };
}
