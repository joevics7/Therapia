"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { avatarVar, initials } from "@/lib/session";
import { useToast } from "./ui";

type Msg = { id: number; alias: string; handle: string; body: string; created_at: string };
const COLS = "id,alias,handle,body,created_at";
const BLOCKED = /(\+?\d[\d\s\-]{6,}\d)|https?:\/\/|www\./i; // same rule as the database; this just gives a quicker message

const Avatar = ({ name }: { name: string }) => (
  <span className="av" style={{ "--s": "30px", background: avatarVar(name) } as React.CSSProperties} aria-hidden="true">{initials(name)}</span>
);

/** Text chat for one group. Saved for 7 days, then deleted. Audio is never recorded. */
export default function GroupChat({ roomId, alias, isHost, compact }: { roomId: string; alias: string; isHost: boolean; compact?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const { say, toast } = useToast();

  const merge = useCallback((incoming: Msg[]) => {
    setMsgs((cur) => {
      const m = new Map(cur.map((x) => [x.id, x]));
      for (const x of incoming) m.set(x.id, x);
      return Array.from(m.values()).sort((a, b) => a.id - b.id).slice(-150);
    });
  }, []);

  // Full reload: also clears anything a host deleted or the 7-day clean-up removed.
  const reload = useCallback(async () => {
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data } = await supabase().from("messages").select(COLS).eq("room_id", roomId).gt("created_at", since).order("id", { ascending: false }).limit(100);
    setMsgs(((data ?? []) as Msg[]).reverse());
    setLoaded(true);
  }, [roomId]);

  useEffect(() => {
    reload();
    const sb = supabase();
    const ch = sb.channel(`chat:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, (p) => merge([p.new as Msg]))
      .subscribe();
    const t = setInterval(reload, 60_000);
    return () => { clearInterval(t); sb.removeChannel(ch); };
  }, [roomId, reload, merge]);

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim().slice(0, 240);
    if (!body) return;
    if (BLOCKED.test(body)) { say("Phone numbers and links aren't allowed. It keeps everyone safe."); return; }
    setText("");
    const { data, error } = await supabase().from("messages").insert({ room_id: roomId, alias, body }).select(COLS).single();
    if (error) {
      setText(body);
      say(error.message.includes("slow_down") ? "Slow down a little." : error.code === "23514" ? "Phone numbers and links aren't allowed." : "Message didn't send. Try again.");
      return;
    }
    merge([data as Msg]);
  }

  async function report(m: Msg) {
    const { error } = await supabase().rpc("report_message", { p_message: m.id, p_reason: "" });
    say(error ? "Couldn't send the report. Try again." : "Reported. The host will review it.");
  }

  async function remove(m: Msg) {
    const { error } = await supabase().from("messages").delete().eq("id", m.id);
    if (error) { say("Couldn't delete that."); return; }
    setMsgs((c) => c.filter((x) => x.id !== m.id));
  }

  return (
    <div className="chat">
      {toast}
      <div className={`panel${compact ? "" : " tall"}`} role="log" aria-live="polite">
        {loaded && msgs.length === 0 && <p className="empty">No messages yet. Be kind. Chat is for support, not contact details.</p>}
        {msgs.map((m) => {
          const mine = m.alias === alias;
          return (
            <div className={`msg${mine ? " me" : ""}`} key={m.id}>
              <Avatar name={m.handle} />
              <div className="bub">
                <div className="who">{mine ? "You" : m.handle}</div>
                <p>{m.body}</p>
                <div className="msg-acts">
                  {!mine && <button onClick={() => report(m)}>Report</button>}
                  {(mine || isHost) && <button onClick={() => remove(m)}>Delete</button>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form className="chatform" onSubmit={send}>
        <input className="field" value={text} onChange={(e) => setText(e.target.value)} maxLength={240} placeholder="Write something kind…" autoComplete="off" aria-label="Message" />
        <button className="btn primary" type="submit" aria-label="Send">Send</button>
      </form>
      <p className="fine">Messages disappear after 7 days. Audio is never recorded.</p>
    </div>
  );
}
