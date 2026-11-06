"use client";

import { useState } from "react";
import { Chips, PageHead, Sheet, useToast } from "@/components/ui";
import { LIB, LIB_FILTERS, type LibItem } from "@/lib/data";
import { useStored } from "@/lib/store";

export default function Library() {
  const [filter, setFilter] = useState("All");
  const [saved, setSaved] = useStored<Record<string, boolean>>("saved", {});
  const [item, setItem] = useState<LibItem | null>(null);
  const { say, toast } = useToast();

  const list = LIB.filter((x) => filter === "All" || (filter === "Saved" ? saved[x.id] : x.type === filter));
  const toggle = (id: string) => setSaved((s) => {
    const n = { ...s };
    if (n[id]) delete n[id]; else { n[id] = true; say("Saved to your library."); }
    return n;
  });

  return (
    <>
      {toast}
      <PageHead title="Library" sub="Books, short reads and calm audio." />
      <Chips list={LIB_FILTERS} cur={filter} onPick={setFilter} />
      {list.map((x) => {
        const free = x.price === "Free";
        return (
          <article className={`rcard pal-${x.pal}`} key={x.id}>
            <div className="tile ankara" aria-hidden="true" />
            <div><div className="rc-cat">{x.type} · {x.len}</div><h3 className="display">{x.title}</h3><p className="blurb">{x.blurb}</p></div>
            <div className="rc-act" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {free
                ? <button className="btn accent sm" onClick={() => setItem(x)}>Open</button>
                : <button className="btn primary sm" onClick={() => say(`Prototype: ${x.title} for ${x.price}. No payment taken.`)}>Buy {x.price}</button>}
              <button className="btn ghost sm" aria-pressed={!!saved[x.id]} onClick={() => toggle(x.id)}>{saved[x.id] ? "Saved ✓" : "Save"}</button>
            </div>
          </article>
        );
      })}
      {list.length === 0 && <p className="empty">Nothing saved yet. Tap Save on anything you want to come back to.</p>}
      <p className="fine">Sample titles. Real content is added before launch.</p>
      {item && (
        <Sheet onClose={() => setItem(null)}>
          <h3 className="display">{item.title}</h3>
          <p className="muted">{item.blurb}</p>
          <div className="placeholder">Prototype: the full {item.type === "Audio" ? "audio" : "text"} opens here.</div>
          <button className="btn primary big" onClick={() => setItem(null)}>Close</button>
        </Sheet>
      )}
    </>
  );
}
