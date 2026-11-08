import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { answerProblem, emailFor, passwordProblem, questionProblem, usernameProblem } from "@/lib/identity";

export const dynamic = "force-dynamic";
const fail = (error: string, status: number, message?: string) => NextResponse.json({ error, message }, { status });

/** Creates a username + password account with a security question. The browser then signs in normally. */
export async function POST(req: Request) {
  const sb = adminClient();
  if (!sb) return fail("not_configured", 503, "Sign-up isn't set up yet.");
  let b: { username?: string; password?: string; question?: string; answer?: string };
  try { b = await req.json(); } catch { return fail("bad_request", 400); }
  const username = (b.username ?? "").trim();
  const password = b.password ?? "";
  const question = (b.question ?? "").trim();
  const answer = b.answer ?? "";

  const problem = usernameProblem(username) || passwordProblem(password) || questionProblem(question) || answerProblem(answer);
  if (problem) return fail("invalid", 400, problem);

  const taken = await sb.from("profiles").select("user_id").ilike("username", username).maybeSingle();
  if (taken.data) return fail("username_taken", 409, "That username is taken. Try another.");

  const created = await sb.auth.admin.createUser({
    email: emailFor(username),
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (created.error || !created.data.user) {
    const dup = /already|registered|exists/i.test(created.error?.message ?? "");
    return dup ? fail("username_taken", 409, "That username is taken. Try another.") : fail("create_failed", 500, "Couldn't create the account. Try again.");
  }
  const id = created.data.user.id;

  const claim = await sb.from("profiles").update({ username }).eq("user_id", id);
  const rec = claim.error ? null : await sb.rpc("set_recovery", { p_user: id, p_question: question, p_answer: answer });
  if (claim.error || rec?.error) {
    await sb.auth.admin.deleteUser(id); // never leave a half-made account behind
    return claim.error?.code === "23505" ? fail("username_taken", 409, "That username is taken. Try another.") : fail("create_failed", 500, "Couldn't create the account. Try again.");
  }
  return NextResponse.json({ ok: true });
}
