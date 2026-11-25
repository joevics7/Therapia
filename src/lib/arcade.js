// Pure logic for the zero-money mini-games in the betting tool. Coins are made up: they can't be bought, withdrawn or traded.
export const START_COINS = 100, DAILY_COINS = 10, CLEAN_DAY_COINS = 30, MAX_STAKE = 5, MAX_CATCHUP_DAYS = 7;
export const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (k, n) => { const [y, m, d] = k.split("-").map(Number); return dayKey(new Date(y, m - 1, d + n)); };
export const newWallet = (now = new Date()) => ({ coins: START_COINS, lastDaily: dayKey(now), lastClean: null });
/** +10 once per day, and +30 for each finished day (since the plan started) with no bet logged. Never negative. */
export function topUp(w, plan, betDays, now = new Date()) {
    const today = dayKey(now);
    let coins = w.coins, lastDaily = w.lastDaily, lastClean = w.lastClean;
    if (lastDaily !== today) {
        coins += DAILY_COINS;
        lastDaily = today;
    }
    if (plan) {
        const startDay = dayKey(new Date(plan.start)), yesterday = addDays(today, -1);
        let from = lastClean ? addDays(lastClean, 1) : startDay;
        if (from < startDay)
            from = startDay;
        const earliest = addDays(yesterday, -(MAX_CATCHUP_DAYS - 1));
        if (from < earliest)
            from = earliest;
        for (let d = from; d <= yesterday; d = addDays(d, 1))
            if (!betDays.has(d))
                coins += CLEAN_DAY_COINS;
        if (yesterday >= startDay)
            lastClean = yesterday;
    }
    return coins === w.coins && lastDaily === w.lastDaily && lastClean === w.lastClean ? w : { coins, lastDaily, lastClean };
}
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
/** A roughly bell-shaped random number around 0 (sum of three uniforms). */
const bell = (r) => (r() + r() + r() - 1.5) * 2;
/** What a winning bet pays: stake x multiplier, rounded, at least +1. Returns the coins gained (not including the stake back). */
export const winnings = (stake, mult) => Math.max(1, Math.round(stake * (mult - 1)));
/** Multiplier for an outcome with probability p: a fair price with a little taken off, shown to one decimal, between 1.2 and 10. */
export const multFor = (p) => clamp(Math.round((0.95 / Math.max(p, 0.01)) * 10) / 10, 1.2, 10);
// ---------- 1. Ball Throw ----------
export const THROWERS = [
    { name: "Chika", emoji: "💪", avg: 38, spread: 5 },
    { name: "Emeka", emoji: "🧢", avg: 31, spread: 7 },
    { name: "Aisha", emoji: "🏃🏾‍♀️", avg: 34, spread: 4 },
    { name: "Tunde", emoji: "🧑🏾‍🦱", avg: 27, spread: 6 },
];
export const throwDistance = (t, r = Math.random) => Math.max(5, Math.round((t.avg + bell(r) * t.spread) * 10) / 10);
/** Your own throw: stop the moving bar near the middle for the best distance. */
export const selfThrow = (power) => Math.round((8 + 52 * (1 - Math.abs(power - 0.5) * 2)) * 10) / 10; // power 0..1
// ---------- 2. Danfo Race ----------
export const RACERS = [
    { id: "danfo", name: "Danfo", emoji: "🚌", speed: 6 },
    { id: "keke", name: "Keke", emoji: "🛺", speed: 7 },
    { id: "okada", name: "Okada", emoji: "🏍️", speed: 9 },
    { id: "bike", name: "Bicycle", emoji: "🚲", speed: 4 },
];
/** One step of the race: every racer moves by speed with some luck. */
export const raceStep = (progress, r = Math.random) => progress.map((p, i) => p + RACERS[i].speed * (0.6 + r() * 0.8));
export function runRace(r = Math.random) {
    let p = RACERS.map(() => 0);
    for (let i = 0; i < 200; i++) {
        p = raceStep(p, r);
        const best = Math.max(...p);
        if (best >= 100)
            return p.indexOf(best);
    }
    return 0;
}
let raceOdds = null;
/** Real win chances, worked out by simulating the same race many times, so the shown prices match what happens. */
export function raceMults() {
    if (raceOdds)
        return raceOdds;
    const wins = RACERS.map(() => 0), N = 3000;
    for (let i = 0; i < N; i++)
        wins[runRace()]++;
    return (raceOdds = wins.map((w) => multFor(w / N)));
}
// ---------- 3. Higher or Lower ----------
export const hiLoMults = (n) => ({ higher: multFor((100 - n) / 99), lower: multFor((n - 1) / 99) });
export const hiLoNext = (r = Math.random) => 1 + Math.floor(r() * 100);
// ---------- 4. Lagos Trip ----------
export const ROUTES = [
    { name: "Ikeja to Lekki", mins: 70 }, { name: "Yaba to Victoria Island", mins: 45 },
    { name: "Surulere to Ikeja", mins: 40 }, { name: "Ajah to Obalende", mins: 80 }, { name: "Mile 12 to Oshodi", mins: 35 },
];
export const CONDITIONS = [
    { id: "rain", label: "Heavy rain ☔", factor: 1.3 }, { id: "rush", label: "Rush hour 🚗", factor: 1.25 },
    { id: "clear", label: "Clear roads 🛣️", factor: 0.85 }, { id: "work", label: "Road works 🚧", factor: 1.15 },
];
export const newTrip = (r = Math.random) => {
    const route = pick(ROUTES, r), cond = pick(CONDITIONS, r);
    return { route, cond, line: Math.round((route.mins * cond.factor) / 5) * 5 };
};
export const tripMinutes = (t, r = Math.random) => Math.max(10, Math.round(t.line + bell(r) * t.line * 0.18));
// ---------- 5. Tug of War ----------
export const FIGHTERS = [
    { name: "Mama Put", emoji: "👩🏾‍🍳", power: 8 }, { name: "Danfo Driver", emoji: "🧔🏾", power: 7 },
    { name: "Jollof Chef", emoji: "🧑🏾‍🍳", power: 6 }, { name: "Gate Man", emoji: "💂🏾", power: 9 },
    { name: "Tailor", emoji: "🧵", power: 5 },
];
export const newMatch = (r = Math.random) => {
    const a = Math.floor(r() * FIGHTERS.length);
    let b = Math.floor(r() * (FIGHTERS.length - 1));
    if (b >= a)
        b++;
    return [a, b];
};
/** Chance that fighter A wins: ratio of their powers (squared, so a stronger rope-puller is clearly favoured). */
export const tugChance = (a, b) => { const x = FIGHTERS[a].power ** 2, y = FIGHTERS[b].power ** 2; return x / (x + y); };
export const tugWinner = (a, b, r = Math.random) => (r() < tugChance(a, b) ? 0 : 1);
