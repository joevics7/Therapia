"use client";

import Link from "next/link";
import { PageHead } from "@/components/ui";

/** The library points to real content only: blog articles and the audio tools. Books come later, with payments. */
export default function Library() {
  return (
    <>
      <PageHead title="Library" sub="Reads and calm audio." />
      <div className="cardgrid">
        <article className="rcard pal-c">
          <div className="tile ankara" aria-hidden="true" />
          <div><div className="rc-cat">Read</div><h3 className="display">The blog</h3><p className="blurb">Plain-language articles on stress, anxiety, grief and getting support.</p></div>
          <div className="rc-act"><Link className="btn accent sm" href="/blog">Open blog</Link></div>
        </article>
        <article className="rcard pal-e">
          <div className="tile ankara" aria-hidden="true" />
          <div><div className="rc-cat">Audio</div><h3 className="display">Meditate</h3><p className="blurb">Guided audio to slow down and reset.</p></div>
          <div className="rc-act"><Link className="btn accent sm" href="/tools#meditate">Open</Link></div>
        </article>
        <article className="rcard pal-a">
          <div className="tile ankara" aria-hidden="true" />
          <div><div className="rc-cat">Audio</div><h3 className="display">Sleep</h3><p className="blurb">Quiet audio to help you wind down.</p></div>
          <div className="rc-act"><Link className="btn accent sm" href="/tools#sleep">Open</Link></div>
        </article>
      </div>
    </>
  );
}
