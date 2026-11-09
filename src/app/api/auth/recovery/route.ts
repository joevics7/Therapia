import { NextResponse } from "next/server";
import { adminClient, checkerClient } from "@/lib/admin";
import { recoveryProblem } from "@/lib/identity";
import { bearer, lookupKey } from "@/lib/server";

export const dynamic = "force-dynamic";
const fail = (error: string, status: number, message?: string) => NextResponse.json({ error, message }, { status });

/** Change your two security questions. Needs your current password, so a stolen open phone can't change them. */
export async function POST(req: Request) {
  const sb = adminClient();
  const token = bearer(req);
  if (!sb) return fail("not_configured", 503);
  if (!token) return fail("unauthorized", 401);
  let b: { password?: string; q1?: string; a1?: string; q2?: string; a2?: string };
  try { b = await req.json(); } catch { return fail("bad_request", 400); }

  const { data: u } = await sb.auth.getUser(token);
  if (!u.user?.email) return fail("unauthorized", 401);
  const [q1, a1, q2, a2] = [(b.q1 ?? "").trim(), b.a1 ?? "", (b.q2 ?? "").trim(), b.a2 ?? ""];
  const problem = recoveryProblem(q1, a1, q2, a2);
  if (problem) return fail("invalid", 400, problem);

  const ok = await sb.rpc("rate_allow", { p_key: `qchange:${u.user.id}`, p_max: 10, p_window_secs: 3600 });
  if (ok.data === false) return fail("rate_limited", 429, "Too many tries. Please wait an hour.");
  const check = await checkerClient().auth.signInWithPassword({ email: u.user.email, password: b.password ?? "" });
  if (check.error) return fail("wrong_password", 401, "Your current password didn't match.");

  const rec = await sb.rpc("set_recovery", { p_user: u.user.id, p_q1: q1, p_a1: a1, p_q2: q2, p_a2: a2, p_lookup: lookupKey(a1, a2) });
  return rec.error ? fail("failed", 500, "Couldn't save. Try again.") : NextResponse.json({ ok: true });
}
