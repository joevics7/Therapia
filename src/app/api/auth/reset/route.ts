import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { passwordProblem } from "@/lib/identity";
import { clientKey, lookupKey } from "@/lib/server";

export const dynamic = "force-dynamic";
const fail = (error: string, status: number, message?: string) => NextResponse.json({ error, message }, { status });

/**
 * Forgot password or forgot username.
 *  { action: "questions", username }                          -> the two security questions
 *  { action: "reset", username, a1, a2, newPassword }         -> new password if BOTH answers are right (5 tries per hour)
 *  { action: "find", a1, a2, month? }                         -> the username that goes with these two answers
 */
export async function POST(req: Request) {
  const sb = adminClient();
  if (!sb) return fail("not_configured", 503, "Recovery isn't set up yet.");
  const key = clientKey(req);
  const allowed = await sb.rpc("rate_allow", { p_key: `reset:${key}`, p_max: 30, p_window_secs: 3600 });
  if (allowed.data === false) return fail("rate_limited", 429, "Too many tries from this connection. Please try again later.");
  let b: { action?: string; username?: string; a1?: string; a2?: string; newPassword?: string; month?: string };
  try { b = await req.json(); } catch { return fail("bad_request", 400); }

  if (b.action === "find") {
    const f = await sb.rpc("rate_allow", { p_key: `find:${key}`, p_max: 10, p_window_secs: 3600 });
    if (f.data === false) return fail("rate_limited", 429, "Too many tries. Please try again in an hour.");
    if (!b.a1 || !b.a2 || b.a1.length > 200 || b.a2.length > 200) return fail("bad_request", 400);
    const { data } = await sb.rpc("find_usernames", { p_lookup: lookupKey(b.a1, b.a2) });
    let rows = (data ?? []) as { username: string; joined: string }[];
    if (rows.length > 1 && !b.month) return fail("need_month", 409, "More than one account matches those answers. Enter the month you created your account.");
    if (b.month) rows = rows.filter((r) => r.joined === b.month);
    if (rows.length !== 1) return fail("not_found", 404, "We couldn't find an account with those answers. Check the spelling and try again.");
    return NextResponse.json({ username: rows[0].username });
  }

  const username = (b.username ?? "").trim();
  if (!username || username.length > 40) return fail("bad_request", 400);

  if (b.action === "questions") {
    const { data } = await sb.rpc("recovery_questions", { p_username: username });
    return Array.isArray(data) && data.length === 2 ? NextResponse.json({ questions: data }) : fail("not_found", 404, "We couldn't find recovery questions for that username.");
  }

  if (b.action === "reset") {
    const problem = passwordProblem(b.newPassword ?? "");
    if (problem) return fail("invalid", 400, problem);
    const { data: uid, error } = await sb.rpc("verify_recovery", { p_username: username, p_a1: b.a1 ?? "", p_a2: b.a2 ?? "" });
    if (error) return /too_many/.test(error.message) ? fail("too_many_attempts", 429, "Too many tries. Please wait an hour and try again.") : fail("failed", 500, "Something went wrong. Try again.");
    if (!uid) return fail("wrong_answer", 401, "One or both answers didn't match.");
    const upd = await sb.auth.admin.updateUserById(uid as string, { password: b.newPassword! });
    if (upd.error) return fail("failed", 500, "Couldn't set the new password. Try again.");
    return NextResponse.json({ ok: true });
  }
  return fail("bad_request", 400);
}
