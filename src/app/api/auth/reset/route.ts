import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { passwordProblem } from "@/lib/identity";

export const dynamic = "force-dynamic";
const fail = (error: string, status: number, message?: string) => NextResponse.json({ error, message }, { status });

/**
 * Forgot password. Two steps:
 *  { action: "question", username }                       -> the security question
 *  { action: "reset", username, answer, newPassword }     -> sets a new password if the answer is right (5 tries per hour)
 */
export async function POST(req: Request) {
  const sb = adminClient();
  if (!sb) return fail("not_configured", 503, "Recovery isn't set up yet.");
  let b: { action?: string; username?: string; answer?: string; newPassword?: string };
  try { b = await req.json(); } catch { return fail("bad_request", 400); }
  const username = (b.username ?? "").trim();
  if (!username || username.length > 40) return fail("bad_request", 400);

  if (b.action === "question") {
    const { data } = await sb.rpc("recovery_question", { p_username: username });
    return data ? NextResponse.json({ question: data }) : fail("not_found", 404, "We couldn't find a recovery question for that username.");
  }

  if (b.action === "reset") {
    const problem = passwordProblem(b.newPassword ?? "");
    if (problem) return fail("invalid", 400, problem);
    const { data: uid, error } = await sb.rpc("verify_recovery", { p_username: username, p_answer: b.answer ?? "" });
    if (error) return /too_many/.test(error.message) ? fail("too_many_attempts", 429, "Too many tries. Please wait an hour and try again.") : fail("failed", 500, "Something went wrong. Try again.");
    if (!uid) return fail("wrong_answer", 401, "That answer didn't match.");
    const upd = await sb.auth.admin.updateUserById(uid as string, { password: b.newPassword! });
    if (upd.error) return fail("failed", 500, "Couldn't set the new password. Try again.");
    return NextResponse.json({ ok: true });
  }
  return fail("bad_request", 400);
}
