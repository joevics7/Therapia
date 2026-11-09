"use client";
import { CUSTOM_QUESTION, QUESTIONS } from "@/lib/identity";

export type Recovery = { s1: string; c1: string; a1: string; s2: string; c2: string; a2: string };
export const emptyRecovery = (): Recovery => ({ s1: QUESTIONS[0], c1: "", a1: "", s2: QUESTIONS[1], c2: "", a2: "" });
export const toRecovery = (v: Recovery) => ({
  q1: v.s1 === CUSTOM_QUESTION ? v.c1 : v.s1, a1: v.a1,
  q2: v.s2 === CUSTOM_QUESTION ? v.c2 : v.s2, a2: v.a2,
});

/** Two different security questions with answers. Used at sign-up and on the account page. */
export default function RecoveryFields({ value, onChange }: { value: Recovery; onChange: (v: Recovery) => void }) {
  const set = (p: Partial<Recovery>) => onChange({ ...value, ...p });
  const one = (n: 1 | 2) => {
    const s = n === 1 ? value.s1 : value.s2;
    const other = n === 1 ? value.s2 : value.s1;
    const c = n === 1 ? value.c1 : value.c2;
    const a = n === 1 ? value.a1 : value.a2;
    return (
      <div className="stack" key={n}>
        <span className="eyebrow">Question {n}</span>
        <select className="field" aria-label={`Security question ${n}`} value={s} onChange={(e) => set(n === 1 ? { s1: e.target.value } : { s2: e.target.value })}>
          {[...QUESTIONS, CUSTOM_QUESTION].filter((q) => q === CUSTOM_QUESTION || q !== other).map((q) => <option key={q}>{q}</option>)}
        </select>
        {s === CUSTOM_QUESTION && <input className="field" maxLength={120} placeholder="Your own question" aria-label={`Your own question ${n}`} value={c} onChange={(e) => set(n === 1 ? { c1: e.target.value } : { c2: e.target.value })} />}
        <input className="field" autoComplete="off" placeholder="Your answer" aria-label={`Answer ${n}`} value={a} onChange={(e) => set(n === 1 ? { a1: e.target.value } : { a2: e.target.value })} />
      </div>
    );
  };
  return <>{one(1)}{one(2)}</>;
}
