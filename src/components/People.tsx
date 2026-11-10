"use client";
import { useEffect, useId, useRef } from "react";

// Original illustrated portraits of smiling people, drawn in code (no image files, so they load instantly on weak data).
// Real photos can replace them: see PhotoSlot below and docs/LANDING-PHOTOS.md.

type Spec = { skin: string; shade: string; hair: string; kind: "afro" | "beard" | "gele" | "braids" | "glasses" | "puffs"; top: string; top2: string; wrap?: string; wrap2?: string; bg: string };

export const PEOPLE: Record<string, Spec> = {
  ada: { skin: "#6b4129", shade: "#52301d", hair: "#17100d", kind: "afro", top: "#f4b52b", top2: "#c4244c", bg: "#e9e2fb" },
  tunde: { skin: "#4a2c1d", shade: "#38201a", hair: "#120d0b", kind: "beard", top: "#2b2178", top2: "#f4b52b", bg: "#fde7ea" },
  ngozi: { skin: "#7a4a2f", shade: "#603a25", hair: "#17100d", kind: "gele", top: "#0e8a55", top2: "#f4b52b", wrap: "#c4244c", wrap2: "#f4b52b", bg: "#fff1d0" },
  zainab: { skin: "#8d5a3b", shade: "#744630", hair: "#17100d", kind: "braids", top: "#c4244c", top2: "#fff", bg: "#dff3e8" },
  kola: { skin: "#5e3a26", shade: "#482b1d", hair: "#120d0b", kind: "glasses", top: "#4b1d7a", top2: "#f4b52b", bg: "#fff1d0" },
  amaka: { skin: "#a86b45", shade: "#8a5636", hair: "#17100d", kind: "puffs", top: "#2b2178", top2: "#ff9ec0", bg: "#e6f1ff" },
};

export function Person({ who, className }: { who: keyof typeof PEOPLE; className?: string }) {
  const s = PEOPLE[who];
  const id = useId().replace(/:/g, "");
  const ink = "#1b0f0a";
  const hairCap = <path d="M69 108 Q70 58 120 56 Q170 58 171 108 Q150 82 120 82 Q90 82 69 108 Z" fill={s.hair} />;
  return (
    <svg className={className} viewBox="0 0 240 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`p${id}`} width="22" height="22" patternUnits="userSpaceOnUse">
          <rect width="22" height="22" fill={s.top} />
          <circle cx="11" cy="11" r="4.2" fill={s.top2} />
          <circle cx="0" cy="0" r="3" fill={s.top2} opacity=".7" /><circle cx="22" cy="22" r="3" fill={s.top2} opacity=".7" />
        </pattern>
        <pattern id={`w${id}`} width="18" height="18" patternUnits="userSpaceOnUse">
          <rect width="18" height="18" fill={s.wrap ?? "#c4244c"} />
          <circle cx="9" cy="9" r="3.4" fill={s.wrap2 ?? "#f4b52b"} />
        </pattern>
      </defs>
      <rect width="240" height="260" fill={s.bg} />
      <circle cx="200" cy="50" r="34" fill="#fff" opacity=".45" />
      <circle cx="30" cy="190" r="26" fill="#fff" opacity=".35" />

      {s.kind === "afro" && <circle cx="120" cy="98" r="74" fill={s.hair} />}
      {s.kind === "puffs" && <><circle cx="68" cy="62" r="28" fill={s.hair} /><circle cx="172" cy="62" r="28" fill={s.hair} /></>}

      <path d="M22 262 C22 214 66 192 120 192 C174 192 218 214 218 262 Z" fill={`url(#p${id})`} />
      <rect x="104" y="160" width="32" height="40" rx="14" fill={s.shade} />
      <path d="M98 193 L120 226 L142 193 Z" fill={s.shade} />
      <circle cx="70" cy="122" r="9" fill={s.skin} /><circle cx="170" cy="122" r="9" fill={s.skin} />
      <ellipse cx="120" cy="118" rx="51" ry="59" fill={s.skin} />

      {(s.kind === "afro" || s.kind === "puffs" || s.kind === "glasses") && hairCap}
      {s.kind === "glasses" && <path d="M69 108 Q70 62 120 60 Q170 62 171 108 Q150 90 120 90 Q90 90 69 108 Z" fill={s.hair} />}
      {s.kind === "beard" && (
        <>
          {hairCap}
          <path d="M70 126 Q70 184 120 188 Q170 184 170 126 Q162 156 146 152 Q120 144 94 152 Q78 156 70 126 Z" fill={s.hair} />
        </>
      )}
      {s.kind === "braids" && (
        <>
          {hairCap}
          {[62, 72, 82].map((x) => <path key={`l${x}`} d={`M${x} 100 Q${x - 14} 156 ${x - 8} 222`} stroke={s.hair} strokeWidth="10" strokeLinecap="round" fill="none" />)}
          {[178, 168, 158].map((x) => <path key={`r${x}`} d={`M${x} 100 Q${x + 14} 156 ${x + 8} 222`} stroke={s.hair} strokeWidth="10" strokeLinecap="round" fill="none" />)}
        </>
      )}
      {s.kind === "gele" && (
        <>
          <path d="M66 96 Q62 46 120 40 Q178 46 174 96 Q150 70 120 70 Q90 70 66 96 Z" fill={`url(#w${id})`} />
          <ellipse cx="156" cy="40" rx="46" ry="26" transform="rotate(-20 156 40)" fill={`url(#w${id})`} stroke="#fff" strokeOpacity=".35" strokeWidth="2" />
          <ellipse cx="94" cy="44" rx="40" ry="22" transform="rotate(16 94 44)" fill={`url(#w${id})`} stroke="#fff" strokeOpacity=".35" strokeWidth="2" />
        </>
      )}

      {s.kind === "glasses" ? (
        <>
          <path d="M92 114 Q101 104 110 114" stroke={ink} strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <path d="M130 114 Q139 104 148 114" stroke={ink} strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <circle cx="101" cy="112" r="16" fill="none" stroke={ink} strokeWidth="3.5" /><circle cx="139" cy="112" r="16" fill="none" stroke={ink} strokeWidth="3.5" />
          <path d="M117 111 Q120 108 123 111" stroke={ink} strokeWidth="3" fill="none" />
        </>
      ) : (
        <>
          <path d="M91 113 Q101 102 111 113" stroke={ink} strokeWidth="4.6" strokeLinecap="round" fill="none" />
          <path d="M129 113 Q139 102 149 113" stroke={ink} strokeWidth="4.6" strokeLinecap="round" fill="none" />
          <path d="M89 98 Q101 91 112 97" stroke={s.hair} strokeWidth="3.6" strokeLinecap="round" fill="none" />
          <path d="M128 97 Q139 91 151 98" stroke={s.hair} strokeWidth="3.6" strokeLinecap="round" fill="none" />
        </>
      )}
      <path d="M113 136 Q120 142 127 136" stroke={s.shade} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <ellipse cx="84" cy="140" rx="10" ry="6" fill="#e0735a" opacity=".22" /><ellipse cx="156" cy="140" rx="10" ry="6" fill="#e0735a" opacity=".22" />
      <path d="M93 146 Q120 182 147 146 Q120 155 93 146 Z" fill="#fff" stroke="#4a1d1d" strokeWidth="3.6" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A picture slot. Shows an illustration by default. If you add a real photo at /public/landing/<name>.jpg
 * (or .webp) it appears on top automatically. If the file is missing, the illustration stays.
 */
export function PhotoSlot({ name, who, className }: { name: string; who: keyof typeof PEOPLE; className?: string }) {
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) el.remove();
  }, []);
  return (
    <div className={`ph ${className ?? ""}`}>
      <Person who={who} className="ph-art" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={img} className="ph-photo" src={`/landing/${name}.jpg`} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} />
    </div>
  );
}
