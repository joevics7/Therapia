"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { avatarVar, getHandle, initials, newHandle, setHandle } from "@/lib/session";

const TOPICS: [string, string][] = [["Marriage & abuse", "b"], ["Betting", "a"], ["Addiction", "e"], ["Grief", "d"], ["Stress & money", "c"]];

export default function Landing() {
  const [handle, setH] = useState("");

  useEffect(() => {
    const saved = getHandle();
    const h = saved || newHandle();
    if (!saved) setHandle(h);
    setH(h);
  }, []);

  const reroll = () => { const h = newHandle(handle); setHandle(h); setH(h); };
  const enter = <Link className="btn primary big" href="/dashboard">Enter as {handle || "…"}</Link>;

  return (
    <>
      <div className="topbar"><span className="wordmark display">Therapia</span></div>
      <h1 className="tag display">Say it out loud. Nobody has to know it&rsquo;s you.</h1>
      <div className="hero ankara pal-a" aria-hidden="true" />
      <div className="namecard">
        <span className="av" style={{ "--s": "72px", background: avatarVar(handle || "x") } as React.CSSProperties}>{initials(handle)}</span>
        <div className="nc-text"><div className="eyebrow">Your name here</div><div className="handle display">{handle || " "}</div></div>
        <button className="btn ghost sm" onClick={reroll}>Another name</button>
      </div>
      {enter}
      <ul className="assure">
        <li><span className="ic">✓</span>No email. No phone number.</li>
        <li><span className="ic">✓</span>Audio is never recorded.</li>
        <li><span className="ic">✓</span>Pick a new name any time.</li>
      </ul>

      <section className="sec">
        <h2 className="sec-h display">How it works</h2>
        <ol className="steps">
          <li><span className="sn">1</span><div><b>Pick a name</b><span className="muted">We give you a random one. No email, no phone.</span></div></li>
          <li><span className="sn">2</span><div><b>Join a room</b><span className="muted">Free voice rooms every week, by topic.</span></div></li>
          <li><span className="sn">3</span><div><b>Listen or speak</b><span className="muted">Stay quiet as long as you like. Raise your hand when you are ready.</span></div></li>
        </ol>
      </section>

      <section className="sec">
        <h2 className="sec-h display">Rooms for what you are carrying</h2>
        <div className="topics">
          {TOPICS.map(([t, p]) => <span className="topic" key={t}><span className={`dot ankara pal-${p}`} aria-hidden="true" />{t}</span>)}
        </div>
      </section>

      <section className="sec">
        <h2 className="sec-h display">More than rooms</h2>
        <ul className="more" style={{ padding: 0 }}>
          <li><span className="ic">◎</span><div><b>Groups</b><span className="muted">Voice rooms led by trained facilitators.</span></div></li>
          <li><span className="ic">✉</span><div><b>Therapy</b><span className="muted">One-on-one voice sessions with licensed therapists.</span></div></li>
          <li><span className="ic">❏</span><div><b>Library</b><span className="muted">Books, short reads and calm audio. Many are free.</span></div></li>
          <li><span className="ic">✦</span><div><b>Tools</b><span className="muted">Breathing, grounding, a private journal and a quick exit.</span></div></li>
        </ul>
      </section>

      <section className="band">
        <h2 className="sec-h display">Built for safety</h2>
        <ul className="assure">
          <li><span className="ic">✓</span>Verified facilitators lead every room.</li>
          <li><span className="ic">✓</span>Women-only rooms use invite codes and a host lobby.</li>
          <li><span className="ic">✓</span>Anyone can report, and hosts can remove people fast.</li>
          <li><span className="ic">✓</span>Help is one tap away, in every screen.</li>
        </ul>
        {enter}
      </section>
    </>
  );
}
