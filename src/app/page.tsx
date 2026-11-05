"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getHandle, initials, avatarVar, newHandle, setHandle } from "@/lib/session";

export default function Landing() {
  const [handle, setH] = useState("");

  useEffect(() => {
    const saved = getHandle();
    const h = saved || newHandle();
    if (!saved) setHandle(h);
    setH(h);
  }, []);

  const reroll = () => {
    const h = newHandle(handle);
    setHandle(h);
    setH(h);
  };

  return (
    <>
      <div className="topbar"><span className="wordmark display">Therapia</span></div>
      <h1 className="tag display">Say it out loud. Nobody has to know it&rsquo;s you.</h1>
      <div className="hero ankara pal-a" aria-hidden="true" />
      <div className="namecard">
        <span className="av" style={{ "--s": "72px", background: avatarVar(handle || "x") } as React.CSSProperties}>{initials(handle)}</span>
        <div className="nc-text">
          <div className="eyebrow">Your name here</div>
          <div className="handle display">{handle || " "}</div>
        </div>
        <button className="btn ghost sm" onClick={reroll}>Another name</button>
      </div>
      <Link className="btn primary big" href="/groups">Enter as {handle || "…"}</Link>
      <ul className="assure">
        <li><span className="ic">✓</span>No email. No phone number.</li>
        <li><span className="ic">✓</span>Audio is never recorded.</li>
        <li><span className="ic">✓</span>Pick a new name any time.</li>
      </ul>
    </>
  );
}
