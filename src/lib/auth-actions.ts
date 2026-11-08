"use client";
import { emailFor } from "./identity";
import { supabase } from "./supabase";

const MATCH = "That username and password didn't match.";

/** Sign in. Returns an error message, or null on success. */
export async function signInWithUsername(username: string, password: string): Promise<string | null> {
  const { error } = await supabase().auth.signInWithPassword({ email: emailFor(username), password });
  return error ? MATCH : null;
}

/** Create an account, then sign in. Returns an error message, or null on success. */
export async function createAccount(b: { username: string; password: string; question: string; answer: string }): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
  } catch { return "No connection. Check your data and try again."; }
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    return j.message ?? "Couldn't create the account. Try again.";
  }
  return signInWithUsername(b.username, b.password);
}

/** Only allow paths inside this app after sign-in. */
export const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard");
