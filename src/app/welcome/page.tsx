"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import NeedsPicker from "@/components/NeedsPicker";
import RequireAuth from "@/components/RequireAuth";
import { supabase } from "@/lib/supabase";

function Welcome() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dest = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/welcome") ? next : "/dashboard";

  async function save(needs: string[]) {
    setBusy(true); setErr("");
    const r = await supabase().from("user_needs").upsert({ needs });
    setBusy(false);
    if (r.error) { setErr("Couldn't save that. Check your connection and try again."); return; }
    router.replace(dest);
  }

  return (
    <div className="pg-narrow stack">
      <h1 className="display ptitle">What do you need help with?</h1>
      <p className="muted">Pick everything that fits. We use this to suggest groups and to choose your morning messages. It stays private to your account, and you can change it any time.</p>
      <NeedsPicker value={sel} onChange={setSel} />
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn primary big" disabled={busy || sel.length === 0} onClick={() => save(sel)}>Continue</button>
      <button className="btn ghost" disabled={busy} onClick={() => save([])}>Skip for now</button>
    </div>
  );
}

export default function WelcomePage() {
  return <RequireAuth><Suspense fallback={null}><Welcome /></Suspense></RequireAuth>;
}
