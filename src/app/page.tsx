"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { avatarVar, initials } from "@/lib/session";

const TOPICS: [string, string][] = [["Marriage & abuse", "b"], ["Betting", "a"], ["Addiction", "e"], ["Grief", "d"], ["Stress & money", "c"]];

export default function Landing() {
  const { ready, session, username } = useAuth();
  const signedIn = ready && !!session;
  const name = username ?? "friend";

  const enter = signedIn
    ? <Link className="btn primary big" href="/dashboard">Enter as {name}</Link>
    : <Link className="btn primary big" href="/login?mode=up">Create your name</Link>;

  return (
    <div className="pg-wide land">
      <div className="topbar"><span className="wordmark display">Therapia</span></div>
      <div className="land-top">
      <h1 className="tag display">Say it out loud. Nobody has to know it&rsquo;s you.</h1>
      <div className="hero ankara pal-a" aria-hidden="true" />
      <div className="land-card">
      {signedIn ? (
        <div className="namecard">
          <span className="av" style={{ "--s": "72px", background: avatarVar(name) } as React.CSSProperties}>{initials(name)}</span>
          <div className="nc-text"><div className="eyebrow">Welcome back</div><div className="handle display">{name}</div></div>
        </div>
      ) : (
        <div className="namecard">
          <span className="av" style={{ "--s": "72px", background: "var(--av1)" } as React.CSSProperties}>?</span>
          <div className="nc-text"><div className="eyebrow">Your name here</div><div className="handle display">Pick any username</div></div>
        </div>
      )}
      {enter}
      {!signedIn && <Link className="btn ghost big" href="/login">I already have a name</Link>}
      <ul className="assure">
        <li><span className="ic">✓</span>No email. No phone number.</li>
        <li><span className="ic">✓</span>Audio is never recorded.</li>
        <li><span className="ic">✓</span>Use a different name in any group.</li>
      </ul>
      </div>
      </div>

      <section className="sec">
        <h2 className="sec-h display">How it works</h2>
        <ol className="steps">
          <li><span className="sn">1</span><div><b>Pick a name</b><span className="muted">A username and a password. No email, no phone.</span></div></li>
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
      <p className="fine"><Link href="/host/login">Facilitator sign-in</Link> · <Link href="/forgot">Forgot password?</Link></p>
    </div>
  );
}
