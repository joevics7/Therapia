"use client";

export function initials(name: string) {
  return name.split(/[ _]+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}
export function avatarVar(name: string) {
  let h = 7;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `var(--av${(h % 6) + 1})`;
}
