"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHead, useToast } from "@/components/ui";
import { useQuickExit } from "@/components/QuickExit";
import { GROUND, PROMPTS, TOOLS } from "@/lib/data";
import { useStored } from "@/lib/store";

type ToolId = (typeof TOOLS)[number]["id"];
const IDS = TOOLS.map((t) => t.id) as string[];

export default function Tools() {
  const [tool, setTool] = useState<ToolId | null>(null);

  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      setTool(IDS.includes(h) ? (h as ToolId) : null);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const open = (id: ToolId | null) => {
    history.replaceState(null, "", id ? `#${id}` : window.location.pathname);
    setTool(id);
    window.scrollTo(0, 0);
  };

  if (!tool) {
    return (
      <>
        <PageHead title="Tools" sub="Small things you can do right now." />
        <div className="toolgrid">
          {TOOLS.map((x) => (
            <button key={x.id} className="toolcard" onClick={() => open(x.id)}>
              <span className="ic">{x.icon}</span><b className="display">{x.name}</b><span className="muted">{x.sub}</span>
            </button>
          ))}
        </div>
        <p className="fine">Your journal stays on this device.</p>
      </>
    );
  }
  return (
    <>
      <div><button className="btn ghost sm" onClick={() => open(null)}>← All tools</button></div>
      {tool === "breathe" && <Breathe />}
      {tool === "ground" && <Ground onDone={() => open(null)} />}
      {tool === "journal" && <Journal />}
      {tool === "safety" && <Safety />}
    </>
  );
}

const NAMES = ["Breathe in", "Hold", "Breathe out", "Hold"];
const SCALE = [1, 1, 0.55, 0.55];

function Breathe() {
  const [t, setT] = useState<number | null>(null); // seconds elapsed, null = idle
  const { say, toast } = useToast();

  useEffect(() => {
    if (t === null) return;
    if (t >= 60) { setT(null); say("Well done. That was one minute."); return; }
    const id = setTimeout(() => setT((x) => (x === null ? null : x + 1)), 1000);
    return () => clearTimeout(id);
  }, [t, say]);

  const running = t !== null;
  const phase = running ? Math.floor(t / 4) % 4 : 0;
  const left = running ? 60 - t : 60;

  return (
    <>
      {toast}
      <h1 className="display ptitle">Breathe</h1>
      <p className="muted">Box breathing: in for 4, hold for 4, out for 4, hold for 4. One minute.</p>
      <div className="breath">
        <div className="br-wrap">
          <div className="br-circle" style={{ transform: `scale(${running ? SCALE[phase] : 0.55})`, transitionDuration: running && (phase === 0 || phase === 2) ? "4s" : "0s" }} />
          <div className="br-text"><b>{running ? NAMES[phase] : "Ready"}</b><span>{running ? 4 - (t % 4) : ""}</span></div>
        </div>
        <p className="fine">0:{String(left).padStart(2, "0")}</p>
        <button className="btn primary" onClick={() => setT(running ? null : 0)}>{running ? "Stop" : "Start"}</button>
      </div>
    </>
  );
}

function Ground({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  if (i >= GROUND.length) {
    return (
      <div className="ground">
        <h1 className="gl">Well done</h1>
        <p className="muted">Notice how your body feels now. You can go again any time.</p>
        <div className="act-btns"><button className="btn primary" onClick={() => setI(0)}>Go again</button><button className="btn ghost" onClick={onDone}>Done</button></div>
      </div>
    );
  }
  const g = GROUND[i];
  return (
    <div className="ground">
      <div className="eyebrow">Step {i + 1} of 5</div>
      <div className="gnum">{g[0]}</div>
      <div className="gl">{g[1]}</div>
      <p className="muted" style={{ maxWidth: "32ch" }}>{g[2]}</p>
      <div className="pdots">{GROUND.map((_, k) => <i key={k} className={k <= i ? "on" : ""} />)}</div>
      <div className="act-btns">
        {i > 0 && <button className="btn ghost" onClick={() => setI(i - 1)}>Back</button>}
        <button className="btn primary" onClick={() => setI(i + 1)}>{i === GROUND.length - 1 ? "Finish" : "Next"}</button>
      </div>
    </div>
  );
}

type Entry = { text: string; when: string };
function Journal() {
  const [entries, setEntries] = useStored<Entry[]>("journal", []);
  const [p, setP] = useState(0);
  const [text, setText] = useState("");
  const { say, toast } = useToast();

  const save = useCallback(() => {
    const v = text.trim();
    if (!v) { say("Write a few words first."); return; }
    setEntries((e) => [{ text: v, when: new Date().toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) }, ...e]);
    setText("");
    say("Saved to your journal.");
  }, [text, setEntries, say]);

  return (
    <>
      {toast}
      <h1 className="display ptitle">Journal</h1>
      <p className="muted">A private place to write. It stays on this device.</p>
      <div className="card">
        <p className="eyebrow">Prompt</p>
        <p style={{ fontWeight: 600 }}>{PROMPTS[p]}</p>
        <button className="btn ghost sm" style={{ justifySelf: "start" }} onClick={() => setP((p + 1) % PROMPTS.length)}>Another prompt</button>
        <label htmlFor="j-in" className="eyebrow">Your words</label>
        <textarea id="j-in" className="field area" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write whatever comes." />
        <button className="btn primary" onClick={save}>Save entry</button>
      </div>
      {entries.length > 0 && (
        <section className="sec">
          <h2 className="sec-h display">Your entries</h2>
          {entries.map((e, i) => (
            <div className="card entry" key={i}>
              <div className="entry-h"><span className="fine">{e.when}</span><button className="icon-btn" aria-label="Delete entry" onClick={() => setEntries((x) => x.filter((_, k) => k !== i))}>🗑</button></div>
              <p>{e.text}</p>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function Safety() {
  const { armed, setArmed, exit } = useQuickExit();
  return (
    <>
      <h1 className="display ptitle">Quick exit</h1>
      <p className="muted">Swaps this screen for a plain shopping list in one tap. Double-tap the word Notes to come back. You can also press Escape twice while the bar is on.</p>
      <div className="card">
        <button className={`btn ${armed ? "soft" : "primary"}`} onClick={() => setArmed(!armed)}>{armed ? "✓ Quick-exit bar is on" : "Show quick-exit bar"}</button>
        <button className="btn ghost" onClick={exit}>Try it now</button>
      </div>
      <div className="card"><p className="fine">It does not clear your phone&rsquo;s history. If someone may check your phone, also lock your screen and leave any open room first.</p></div>
    </>
  );
}
