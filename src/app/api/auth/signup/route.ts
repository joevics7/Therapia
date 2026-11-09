import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { emailFor, passwordProblem, recoveryProblem, usernameProblem } from "@/lib/identity";
import { clientKey, lookupKey } from "@/lib/server";

export const dynamic = "force-dynamic";
const fail = (error: string, status: number, message?: string) => NextResponse.json({ error, message }, { status });

/** Creates a username + password account with two security questions. The browser then signs in normally. */
export async function POST(req: Request) {
  const sb = adminClient();
  if (!sb) return fail("not_configured", 503, "Sign-up isn't set up yet.");
  const allowed = await sb.rpc("rate_allow", { p_key: `signup:${clientKey(req)}`, p_max: 20, p_window_secs: 3600 });
  if (allowed.data === false) return fail("rate_limited", 429, "Too many sign-ups from this connection. Please try again later.");
  let b: { username?: string; password?: string; q1?: string; a1?: string; q2?: string; a2?: string };
  try { b = await req.json(); } catch { return fail("bad_request", 400); }
  const username = (b.username ?? "").trim();
  const password = b.password ?? "";
  const [q1, a1, q2, a2] = [(b.q1 ?? "").trim(), b.a1 ?? "", (b.q2 ?? "").trim(), b.a2 ?? ""];

  const problem = usernameProblem(username) || passwordProblem(password) || recoveryProblem(q1, a1, q2, a2);
  if (problem) return fail("invalid", 400, problem);

  const taken = await sb.from("profiles").select("user_id").ilike("username", username).maybeSingle();
  if (taken.data) return fail("username_taken", 409, "That username is taken. Try another.");

  const created = await sb.auth.admin.createUser({ email: emailFor(username), password, email_confirm: true, user_metadata: { username } });
  if (created.error || !created.data.user) {
    const dup = /already|registered|exists/i.test(created.error?.message ?? "");
    return dup ? fail("username_taken", 409, "That username is taken. Try another.") : fail("create_failed", 500, "Couldn't create the account. Try again.");
  }
  const id = created.data.user.id;

  const claim = await sb.from("profiles").update({ username }).eq("user_id", id);
  const rec = claim.error ? null : await sb.rpc("set_recovery", { p_user: id, p_q1: q1, p_a1: a1, p_q2: q2, p_a2: a2, p_lookup: lookupKey(a1, a2) });
  if (claim.error || rec?.error) {
    await sb.auth.admin.deleteUser(id); // never leave a half-made account behind
    return claim.error?.code === "23505" ? fail("username_taken", 409, "That username is taken. Try another.") : fail("create_failed", 500, "Couldn't create the account. Try again.");
  }
  return NextResponse.json({ ok: true });
}
