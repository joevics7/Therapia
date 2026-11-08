import { NextResponse } from "next/server";
import { adminClient, checkerClient } from "@/lib/admin";
import { answerProblem, questionProblem } from "@/lib/identity";
import { bearer } from "@/lib/server";

export const dynamic = "force-dynamic";
const fail = (error: string, status: number, message?: string) => NextResponse.json({ error, message }, { status });

/** Change your security question. Needs your current password, so a stolen open phone can't change it. */
export async function POST(req: Request) {
  const sb = adminClient();
  const token = bearer(req);
  if (!sb) return fail("not_configured", 503);
  if (!token) return fail("unauthorized", 401);
  let b: { password?: string; question?: string; answer?: string };
  try { b = await req.json(); } catch { return fail("bad_request", 400); }

  const { data: u } = await sb.auth.getUser(token);
  if (!u.user?.email) return fail("unauthorized", 401);
  const problem = questionProblem((b.question ?? "").trim()) || answerProblem(b.answer ?? "");
  if (problem) return fail("invalid", 400, problem);

  const check = await checkerClient().auth.signInWithPassword({ email: u.user.email, password: b.password ?? "" });
  if (check.error) return fail("wrong_password", 401, "Your current password didn't match.");

  const rec = await sb.rpc("set_recovery", { p_user: u.user.id, p_question: (b.question ?? "").trim(), p_answer: b.answer });
  return rec.error ? fail("failed", 500, "Couldn't save. Try again.") : NextResponse.json({ ok: true });
}
