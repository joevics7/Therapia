"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { PhotoSlot, Person } from "@/components/People";

const ROOMS: { t: string; d: string; p: string }[] = [
  { t: "Abusive marriages", d: "Say what is happening at home to people who understand.", p: "b" },
  { t: "Betting", d: "Lost money, lost sleep. Talk about it without shame.", p: "a" },
  { t: "Alcohol and drugs", d: "Recovery is easier when you are not alone in it.", p: "e" },
  { t: "Grief", d: "Missing someone? Sit with others who miss someone too.", p: "d" },
  { t: "Money stress", d: "Pressure from work, family and bills. Breathe here.", p: "c" },
  { t: "Anxiety and panic", d: "Racing thoughts and tight chests, shared and eased.", p: "b" },
  { t: "Depression", d: "Heavy days are easier with people who understand.", p: "d" },
  { t: "Heartbreak", d: "Breakups, betrayal and love that did not work out.", p: "c" },
  { t: "Job loss and career", d: "Unemployment, burnout and fear about the future.", p: "e" },
];

export default function Landing() {
  const { ready, session } = useAuth();
  const signedIn = ready && !!session;

  const join = signedIn
    ? <Link className="btn accent big" href="/dashboard">Go to your dashboard</Link>
    : <Link className="btn accent big" href="/login?mode=up">Join Therapia</Link>;

  return (
    <div className="lp">
      <header className="lp-nav">
        <span className="wordmark display">Therapia</span>
        <nav aria-label="Account">
          {signedIn
            ? <Link className="btn primary sm" href="/dashboard">Dashboard</Link>
            : <><Link className="btn ghost sm" href="/login">Sign in</Link><Link className="btn primary sm" href="/login?mode=up">Join</Link></>}
        </nav>
      </header>

      <section className="lp-hero">
        <div className="lp-copy">
          <span className="lp-pill">Free · Anonymous · Made for Africa</span>
          <h1 className="display">Say it out loud.<br />Nobody has to know it&rsquo;s&nbsp;you.</h1>
          <p>Therapia is a safe place to talk. Join free voice groups led by trained facilitators, at set times, chat with people who get it, or book a therapist. You choose a username, never your real name.</p>
          <div className="lp-cta">{join}{!signedIn && <Link className="btn ghost big" href="/login">I already have an account</Link>}</div>
          <ul className="lp-ticks">
            <li>No email. No phone number.</li>
            <li>Audio is never recorded.</li>
            <li>Change your voice if you want to.</li>
          </ul>
        </div>
        <div className="lp-collage" aria-hidden="true">
          <PhotoSlot name="hero-1" who="ada" className="c1" />
          <PhotoSlot name="hero-2" who="tunde" className="c2" />
          <PhotoSlot name="hero-3" who="ngozi" className="c3" />
          <span className="lp-chip k1">🎙 Live now · Grief circle</span>
          <span className="lp-chip k2">🔒 Anonymous</span>
        </div>
      </section>

      <section className="lp-sec">
        <h2 className="display">What is Therapia?</h2>
        <p className="lp-lead">Many of us carry things we cannot say at home, at church or at work. Therapia gives you a private place to say them, and people who will listen without judging.</p>
        <div className="lp-trio">
          <div className="lp-card"><PhotoSlot name="about-1" who="zainab" className="sm" /><h3>Talk in voice rooms</h3><p>Join a group by topic. Listen quietly for as long as you like. Raise your hand when you are ready to speak.</p></div>
          <div className="lp-card"><PhotoSlot name="about-2" who="kola" className="sm" /><h3>Chat, then it disappears</h3><p>Every group has a text chat. Messages delete themselves after 7 days.</p></div>
          <div className="lp-card"><PhotoSlot name="about-3" who="amaka" className="sm" /><h3>Talk to a therapist</h3><p>Book one-on-one voice sessions with licensed therapists when you want more support.</p></div>
        </div>
      </section>

      <section className="lp-sec">
        <h2 className="display">Rooms for what you are carrying</h2>
        <div className="lp-rooms">
          {ROOMS.map((r) => (
            <div className="lp-room" key={r.t}><span className={`dot ankara pal-${r.p}`} aria-hidden="true" /><div><b>{r.t}</b><span>{r.d}</span></div></div>
          ))}
          <div className="lp-room women"><span className="dot ankara pal-e" aria-hidden="true" /><div><b>Women-only rooms</b><span>Invite codes and a host lobby, so everyone who comes in is a woman.</span></div></div>
        </div>
      </section>

      <section className="lp-sec lp-how">
        <h2 className="display">How it works</h2>
        <ol className="lp-steps">
          <li><span>1</span><div><b>Join</b><p>Pick a username and password. Add two security questions so you can get back in.</p></div></li>
          <li><span>2</span><div><b>Find your room</b><p>Open your dashboard and choose a group that fits what you are going through.</p></div></li>
          <li><span>3</span><div><b>Listen or speak</b><p>Appear by your username, or hide it on any message. Change your voice if it helps.</p></div></li>
        </ol>
      </section>

      <section className="lp-sec lp-safe">
        <div className="lp-safe-in">
          <div>
            <h2 className="display">Built to keep you safe</h2>
            <ul className="lp-ticks big">
              <li>Facilitators lead every room.</li>
              <li>Report anyone. Hosts can remove people fast.</li>
              <li>Quick exit hides the app in one tap.</li>
              <li>Real helplines are one tap away on every screen.</li>
            </ul>
          </div>
          <div className="lp-faces" aria-hidden="true">
            <Person who="amaka" className="f" /><Person who="kola" className="f" /><Person who="zainab" className="f" /><Person who="ada" className="f" />
          </div>
        </div>
      </section>

      <section className="lp-final">
        <h2 className="display">You do not have to carry it alone.</h2>
        <p>It takes a minute to join. No email needed.</p>
        <div className="lp-cta one">{join}</div>
      </section>

      <footer className="lp-foot">
        <span className="muted">Therapia is peer support and therapy booking. If you are in danger now, call 112.</span>
        <span><Link href="/host/login">Facilitator sign-in</Link> · <Link href="/forgot">Forgot password?</Link></span>
      </footer>
    </div>
  );
}
