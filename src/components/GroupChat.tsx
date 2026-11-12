"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authPost } from "@/lib/api";
import { MASCOT_NAME, TAG_RE, isQuestion } from "@/lib/mascot-shared";
import { supabase } from "@/lib/supabase";
import { avatarVar, initials } from "@/lib/session";
import { useToast } from "./ui";

type Msg = { id: number; alias: string; handle: string; body: string; created_at: string; anonymous?: boolean; is_ai?: boolean };
const COLS = "id,alias,handle,body,created_at,anonymous,is_ai";
const BLOCKED = /(\+?\d[\d\s\-]{6,}\d)|https?:\/\/|www\./i; // same rule as the database; this just gives a quicker message

const Avatar = ({ name, kind }: { name: string; kind?: "ai" | "anon" }) => (
  <span className={`av${kind === "ai" ? " av-ai" : ""}`} style={{ "--s": "30px", background: kind === "anon" ? "var(--muted)" : avatarVar(name) } as React.CSSProperties} aria-hidden="true">
    {kind === "ai" ? "✦" : kind === "anon" ? "?" : initials(name)}
  </span>
);

/** Text chat for one group. Saved for 7 days, then deleted. Audio is never recorded. */
export default function GroupChat({ roomId, alias, isHost, compact }: { roomId: string; alias: string; isHost: boolean; compact?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [anon, setAnon] = useState(false);
  const [mine, setMine] = useState<Set<number>>(new Set()); // my own anonymous messages
  const [thinking, setThinking] = useState(false);
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
    const own = await supabase().rpc("my_anon_message_ids", { p_room: roomId });
    if (Array.isArray(own.data)) setMine(new Set(own.data as number[]));
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
    const { data, error } = await supabase().rpc("post_message", { p_room: roomId, p_body: body, p_anonymous: anon });
    if (error || !data) {
      setText(body);
      const m = error?.message ?? "";
      say(m.includes("slow_down") ? "Slow down a little." : error?.code === "23514" ? "Phone numbers and links aren't allowed." : "Message didn't send. Try again.");
      return;
    }
    const sent = data as Msg;
    if (sent.anonymous) setMine((s) => new Set(s).add(sent.id));
    merge([sent]);
    // The mascot may answer if it was tagged, or if this is a question and nobody else is around.
    if (TAG_RE.test(body) || isQuestion(body)) {
      const tagged = TAG_RE.test(body);
      if (tagged) setThinking(true);
      authPost("/api/mascot", { roomId, messageId: sent.id }).catch(() => {}).finally(() => { if (tagged) setThinking(false); });
    }
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
          const own = m.alias === alias || mine.has(m.id);
          const ai = !!m.is_ai;
          return (
            <div className={`msg${own ? " me" : ""}${ai ? " ai" : ""}`} key={m.id}>
              <Avatar name={m.handle} kind={ai ? "ai" : m.anonymous ? "anon" : undefined} />
              <div className="bub">
                <div className="who">{ai ? <>{MASCOT_NAME} <span className="aitag">AI helper</span></> : own ? (m.anonymous ? "You (username hidden)" : "You") : m.handle}</div>
                <p>{m.body}</p>
                <div className="msg-acts">
                  {!own && <button onClick={() => report(m)}>{ai ? "Report this reply" : "Report"}</button>}
                  {(own || isHost) && <button onClick={() => remove(m)}>Delete</button>}
                </div>
              </div>
            </div>
          );
        })}
        {thinking && <p className="fine typing" role="status">{MASCOT_NAME} is thinking…</p>}
        <div ref={end} />
      </div>
      <form className="chatform" onSubmit={send}>
        <input className="field" value={text} onChange={(e) => setText(e.target.value)} maxLength={240} placeholder="Write something kind…" autoComplete="off" aria-label="Message" />
        <button className="btn primary" type="submit" aria-label="Send">Send</button>
      </form>
      <div className="chat-opts">
        <label className="check"><input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />Hide my username</label>
        <button type="button" className="btn ghost sm" onClick={() => setText((t) => (TAG_RE.test(t) ? t : `@${MASCOT_NAME} ${t}`))}>✦ Ask {MASCOT_NAME}</button>
      </div>
      <p className="fine">Messages disappear after 7 days. Audio is never recorded. Hidden messages do not show your username, but hosts can still act on abuse.</p>
      <p className="fine">{MASCOT_NAME} is an AI helper, not a therapist. Messages sent to {MASCOT_NAME} are processed by AI services (Gemini, DeepSeek), so never share personal details. In an emergency call 112.</p>
    </div>
  );
}
