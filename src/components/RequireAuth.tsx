"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";

/** Pages inside the app need a signed-in account. Everyone else goes to the sign-in page and comes back after. */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, session, error } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (ready && !session && !error) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [ready, session, error, router, path]);

  if (error === "not_configured") return <div className="pg-narrow"><p className="err">Accounts aren&rsquo;t set up yet. Add the Supabase values to .env.local.</p></div>;
  if (!ready || !session) return <div className="pg-narrow"><p className="muted">Loading…</p></div>;
  return <>{children}</>;
}
