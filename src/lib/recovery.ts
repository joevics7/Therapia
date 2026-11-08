"use client";
import { wordlist } from "@scure/bip39/wordlists/english.js";

// The recovery phrase is the only thing that restores an anonymous account on a new phone.
// Six random words from a 2048-word list is about 66 bits. We derive a private sign-in from it,
// so no email or phone is ever collected. If the phrase is lost, the account cannot be recovered.
const DOMAIN = process.env.NEXT_PUBLIC_RECOVERY_EMAIL_DOMAIN || "recovery.therapia.invalid";
const WORDS = 6;

export function generatePhrase(): string {
  const n = new Uint16Array(WORDS);
  crypto.getRandomValues(n);
  return Array.from(n, (x) => wordlist[x & 2047]).join(" ");
}

export function normalizePhrase(p: string): string {
  return p.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean).join(" ");
}

export function phraseValid(p: string): boolean {
  const w = normalizePhrase(p).split(" ");
  return w.length === WORDS && w.every((x) => wordlist.includes(x));
}

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function credentialsFor(phrase: string) {
  const p = normalizePhrase(phrase);
  const [e, pw] = await Promise.all([sha256Hex("therapia:email:" + p), sha256Hex("therapia:password:" + p)]);
  return { email: `u${e.slice(0, 24)}@${DOMAIN}`, password: pw };
}

export const isRecoveryEmail = (email?: string | null) => !!email && email.endsWith("@" + DOMAIN);
