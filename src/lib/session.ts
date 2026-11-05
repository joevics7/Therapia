"use client";

// Per-tab convenience storage. Nothing here leaves the device except what is sent when joining a room.
const get = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } };

export const getHandle = () => get("therapia.handle");
export const setHandle = (v: string) => set("therapia.handle", v);
export const getHostKey = () => get("therapia.hostKey") ?? "";
export const setHostKey = (v: string) => set("therapia.hostKey", v);

const ADJ = ["Gentle", "Brave", "Calm", "Sweet", "Bold", "Patient", "Warm", "Steady", "Bright", "Kind"];
const NOUN = ["Zobo", "Mango", "Suya", "Plantain", "Agama", "Baobab", "Kola", "Palm", "Drum", "Eagle"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export function newHandle(prev = "") {
  let h = "";
  do { h = `${pick(ADJ)} ${pick(NOUN)}`; } while (h === prev);
  return h;
}

export function initials(name: string) {
  return name.split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}
export function avatarVar(name: string) {
  let h = 7;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `var(--av${(h % 6) + 1})`;
}
