// Pure logic for the zero-money mini-games in the betting tool. Coins are made up: they can't be bought, withdrawn or traded.

export type Wallet = { coins: number; lastDaily: string; lastClean: string | null };
export const START_COINS = 100, DAILY_COINS = 10, CLEAN_DAY_COINS = 30, MAX_STAKE = 5, MAX_CATCHUP_DAYS = 7;

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (k: string, n: number) => { const [y, m, d] = k.split("-").map(Number); return dayKey(new Date(y, m - 1, d + n)); };

export const newWallet = (now = new Date()): Wallet => ({ coins: START_COINS, lastDaily: dayKey(now), lastClean: null });

/** +10 once per day, and +30 for each finished day (since the plan started) with no bet logged. Never negative. */
export function topUp(w: Wallet, plan: { start: string } | null, betDays: Set<string>, now = new Date()): Wallet {
  const today = dayKey(now);
  let coins = w.coins, lastDaily = w.lastDaily, lastClean = w.lastClean;
  if (lastDaily !== today) { coins += DAILY_COINS; lastDaily = today; }
  if (plan) {
    const startDay = dayKey(new Date(plan.start)), yesterday = addDays(today, -1);
    let from = lastClean ? addDays(lastClean, 1) : startDay;
    if (from < startDay) from = startDay;
    const earliest = addDays(yesterday, -(MAX_CATCHUP_DAYS - 1));
    if (from < earliest) from = earliest;
    for (let d = from; d <= yesterday; d = addDays(d, 1)) if (!betDays.has(d)) coins += CLEAN_DAY_COINS;
    if (yesterday >= startDay) lastClean = yesterday;
  }
  return coins === w.coins && lastDaily === w.lastDaily && lastClean === w.lastClean ? w : { coins, lastDaily, lastClean };
}

export type Rng = () => number;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
export const pick = <T,>(a: readonly T[], r: Rng = Math.random) => a[Math.floor(r() * a.length)];
/** A roughly bell-shaped random number around 0 (sum of three uniforms). */
const bell = (r: Rng) => (r() + r() + r() - 1.5) * 2;

/** A small fixed-seed generator, so prices worked out by simulation are the same every time they are shown. */
const seeded = (seed: number): Rng => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** What a winning bet pays: stake x multiplier, rounded, at least +1. Returns the coins gained (not including the stake back). */
export const winnings = (stake: number, mult: number) => Math.max(1, Math.round(stake * (mult - 1)));
/** Multiplier for an outcome with probability p: a fair price with a little taken off, shown to one decimal, between 1.2 and 10. */
export const multFor = (p: number) => clamp(Math.round((0.95 / Math.max(p, 0.01)) * 10) / 10, 1.2, 10);

// ---------- 1. Ball Throw ----------
export const THROWERS = [
  { name: "Chika", emoji: "💪", avg: 38, spread: 5 },
  { name: "Emeka", emoji: "🧢", avg: 31, spread: 7 },
  { name: "Aisha", emoji: "🏃🏾‍♀️", avg: 34, spread: 4 },
  { name: "Tunde", emoji: "🧑🏾‍🦱", avg: 27, spread: 6 },
] as const;
export type Thrower = (typeof THROWERS)[number];
export const THROW_MAX = 70; // metres at the end of the bar
/** Each throw comes at one of five speeds, picked at random. The speed changes how far it goes. The factors average to 1, so Over and Under stay even. */
export const THROW_LEVELS = [
  { level: 1, name: "Slow", factor: 0.65, secs: 1.9 },
  { level: 2, name: "Easy", factor: 0.82, secs: 1.5 },
  { level: 3, name: "Steady", factor: 1, secs: 1.2 },
  { level: 4, name: "Fast", factor: 1.18, secs: 0.9 },
  { level: 5, name: "Lightning", factor: 1.35, secs: 0.6 },
] as const;
export type ThrowLevel = (typeof THROW_LEVELS)[number];
export function throwOutcome(t: Thrower, r: Rng = Math.random): { dist: number; level: ThrowLevel } {
  const level = pick(THROW_LEVELS, r);
  const d = Math.round((t.avg * level.factor + bell(r) * t.spread) * 10) / 10;
  return { dist: clamp(d, 5, THROW_MAX - 2), level };
}
export const throwDistance = (t: Thrower, r: Rng = Math.random) => Math.max(5, Math.round((t.avg + bell(r) * t.spread) * 10) / 10);
/** Your own throw: stop the moving bar near the middle for the best distance. */
export const selfThrow = (power: number) => Math.round((8 + 52 * (1 - Math.abs(power - 0.5) * 2)) * 10) / 10; // power 0..1

// ---------- 2. Danfo Race ----------
export const RACERS = [
  { id: "danfo", name: "Danfo", emoji: "🚌", speed: 6 },
  { id: "keke", name: "Keke", emoji: "🛺", speed: 7 },
  { id: "okada", name: "Okada", emoji: "🏍️", speed: 9 },
  { id: "bike", name: "Bicycle", emoji: "🚲", speed: 4 },
] as const;
/** One step of the race: every racer moves by speed with some luck. */
export const raceStep = (progress: number[], r: Rng = Math.random) => progress.map((p, i) => p + RACERS[i].speed * 0.1 + r() * 6);
export function runRace(r: Rng = Math.random): number {
  let p = RACERS.map(() => 0);
  for (let i = 0; i < 200; i++) { p = raceStep(p, r); const best = Math.max(...p); if (best >= 100) return p.indexOf(best); }
  return 0;
}
let raceOdds: number[] | null = null;
/** Real win chances, worked out by simulating the same race many times, so the shown prices match what happens. */
export function raceMults(): number[] {
  if (raceOdds) return raceOdds;
  const wins = RACERS.map(() => 0), N = 3000;
  for (let i = 0; i < N; i++) wins[runRace()]++;
  return (raceOdds = wins.map((w) => multFor(w / N)));
}

// ---------- 3. Higher or Lower ----------
// The number drifts a little each round, with now and then a big jump, so it can't be read from the number alone.
export const hiLoNext = (n: number, r: Rng = Math.random) => {
  let x = Math.round(n + bell(r) * 14 + (r() < 0.12 ? (r() < 0.5 ? -1 : 1) * (20 + r() * 25) : 0));
  if (x > 100) x = 200 - x; if (x < 1) x = 2 - x;
  return clamp(x, 1, 100);
};
export const hiLoStart = (r: Rng = Math.random) => 15 + Math.floor(r() * 71);
const hiLoCache = new Map<number, { higher: number; lower: number }>();
/** Prices from the real chances of the next number being higher or lower (worked out by simulation). */
export function hiLoMults(n: number) {
  const hit = hiLoCache.get(n); if (hit) return hit;
  const r = seeded(n * 97 + 5), N = 2000; let up = 0, down = 0;
  for (let i = 0; i < N; i++) { const x = hiLoNext(n, r); if (x > n) up++; else if (x < n) down++; }
  const m = { higher: multFor(up / N), lower: multFor(down / N) };
  hiLoCache.set(n, m); return m;
}

// ---------- 4. Lagos Trip ----------
export const ROUTES = [
  { name: "Ikeja to Lekki", mins: 70 }, { name: "Yaba to Victoria Island", mins: 45 },
  { name: "Surulere to Ikeja", mins: 40 }, { name: "Ajah to Obalende", mins: 80 }, { name: "Mile 12 to Oshodi", mins: 35 },
] as const;
export const CONDITIONS = [
  { id: "rain", label: "Heavy rain ☔", factor: 1.3 }, { id: "rush", label: "Rush hour 🚗", factor: 1.25 },
  { id: "clear", label: "Clear roads 🛣️", factor: 0.85 }, { id: "work", label: "Road works 🚧", factor: 1.15 },
] as const;
export type Trip = { route: (typeof ROUTES)[number]; cond: (typeof CONDITIONS)[number]; line: number };
export const newTrip = (r: Rng = Math.random): Trip => {
  const route = pick(ROUTES, r), cond = pick(CONDITIONS, r);
  return { route, cond, line: Math.round((route.mins * cond.factor) / 5) * 5 };
};
/** The trip you can't plan for: now and then an accident (much slower) or a shortcut (much faster). */
export const tripMinutes = (t: Trip, r: Rng = Math.random) => {
  const e = r(), f = e < 0.12 ? 1.5 : e < 0.22 ? 0.7 : 1;
  return Math.max(10, Math.round((t.line + bell(r) * t.line * 0.18) * f));
};
export type TripBucket = "quick" | "normal" | "stuck";
export const TRIP_BUCKETS: { id: TripBucket; label: string }[] = [{ id: "quick", label: "Quick" }, { id: "normal", label: "About right" }, { id: "stuck", label: "Stuck" }];
export const tripLimits = (t: Trip) => ({ lo: Math.round((t.line * 0.85) / 5) * 5, hi: Math.round((t.line * 1.15) / 5) * 5 });
export const tripBucket = (t: Trip, mins: number): TripBucket => { const { lo, hi } = tripLimits(t); return mins < lo ? "quick" : mins > hi ? "stuck" : "normal"; };
/** Prices for the three outcomes, from simulating this trip many times. */
export function tripMults(t: Trip): Record<TripBucket, number> {
  const r = seeded(t.line * 31 + t.route.mins), N = 2000, c = { quick: 0, normal: 0, stuck: 0 };
  for (let i = 0; i < N; i++) c[tripBucket(t, tripMinutes(t, r))]++;
  return { quick: multFor(c.quick / N), normal: multFor(c.normal / N), stuck: multFor(c.stuck / N) };
}

// ---------- 5. Tug of War ----------
export const FIGHTERS = [
  { name: "Mama Put", emoji: "👩🏾‍🍳", power: 8 }, { name: "Danfo Driver", emoji: "🧔🏾", power: 7 },
  { name: "Jollof Chef", emoji: "🧑🏾‍🍳", power: 6 }, { name: "Gate Man", emoji: "💂🏾", power: 9 },
  { name: "Tailor", emoji: "🧵", power: 5 },
] as const;
export const newMatch = (r: Rng = Math.random) => {
  const a = Math.floor(r() * FIGHTERS.length); let b = Math.floor(r() * (FIGHTERS.length - 1)); if (b >= a) b++;
  return [a, b] as const;
};
/** Chance that fighter A wins: ratio of their powers (squared, so a stronger rope-puller is clearly favoured). */
export const tugChance = (a: number, b: number) => { const x = FIGHTERS[a].power ** 2, y = FIGHTERS[b].power ** 2; return x / (x + y); };
export const tugWinner = (a: number, b: number, r: Rng = Math.random) => (r() < tugChance(a, b) ? 0 : 1);

// ---------- 6. Pick the Card ----------
export const CARD_COUNT = 5;
export const CARD_FACES = ["2♣", "9♦", "K♠", "5♥", "J♣", "7♦"] as const;
/** Five cards face down, one is the Ace. Picking it right has a 1 in 5 chance. */
export const cardMult = multFor(1 / CARD_COUNT);
export const dealCards = (r: Rng = Math.random) => {
  const ace = Math.floor(r() * CARD_COUNT);
  const decoys = [...CARD_FACES].sort(() => r() - 0.5);
  let d = 0;
  return { ace, faces: Array.from({ length: CARD_COUNT }, (_, i) => (i === ace ? "A♥" : decoys[d++])) };
};
