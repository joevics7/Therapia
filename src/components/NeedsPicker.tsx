"use client";
import { NEEDS } from "@/lib/needs";

/** Pick any number of topics. Used in the first-time welcome step and when changing them later. */
export default function NeedsPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="row" style={{ flexWrap: "wrap", gap: 8 }} role="group" aria-label="What you need help with">
      {NEEDS.map((n) => (
        <button key={n.id} type="button" aria-pressed={value.includes(n.id)} className={`btn ${value.includes(n.id) ? "primary" : "soft"}`} onClick={() => toggle(n.id)}>
          <span aria-hidden="true">{n.emoji}</span> {n.label}
        </button>
      ))}
    </div>
  );
}
