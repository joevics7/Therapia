"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtLagos } from "@/lib/rooms";
import { supabase } from "@/lib/supabase";

type Req = { id: string; handle: string; invited_by_handle: string | null; created_at: string };

/** People asking to join a closed group through a member's invitation link. For hosts and admins. */
export default function JoinRequests({ roomId, say, onChanged }: { roomId: string; say: (m: string) => void; onChanged?: () => void }) {
  const [list, setList] = useState<Req[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase().rpc("list_join_requests", { p_room: roomId });
    setList((data ?? []) as Req[]);
  }, [roomId]);
  useEffect(() => { load(); }, [load]);

  async function decide(r: Req, approve: boolean) {
    const { error } = await supabase().rpc("decide_join", { p_request: r.id, p_approve: approve });
    if (error) { say("That didn't work. Try again."); return; }
    say(approve ? `${r.handle} can now join.` : "Request declined.");
    load(); onChanged?.();
  }
  if (list.length === 0) return null;
  return (
    <div className="stack">
      <div className="eyebrow">Asking to join ({list.length})</div>
      {list.map((r) => (
        <div className="row adm-line" key={r.id}>
          <span><b>{r.handle}</b><br /><span className="fine">Invited by {r.invited_by_handle ?? "a member"} · {fmtLagos(r.created_at)}</span></span>
          <span className="row" style={{ gap: 6 }}>
            <button className="btn soft sm" onClick={() => decide(r, true)}>Approve</button>
            <button className="btn ghost sm" onClick={() => decide(r, false)}>Decline</button>
          </span>
        </div>
      ))}
    </div>
  );
}
