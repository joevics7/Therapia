// Sample content for the MVP. Real therapists, titles and prices come from the database later.
export type Pro = { id: string; name: string; role: string; tags: string[]; lang: string; price: number; slots: string[]; pal: "a" | "b" | "c" | "d" | "e" };
export const PROS: Pro[] = [
  { id: "t1", name: "Dr Amaka Obi", role: "Clinical psychologist", tags: ["Marriage", "Trauma"], lang: "English, Igbo, Pidgin", price: 8000, slots: ["Today 4:00 PM", "Today 6:30 PM", "Tomorrow 10:00 AM"], pal: "b" },
  { id: "t2", name: "Mr Seyi Adeyemi", role: "Addiction counsellor", tags: ["Addiction"], lang: "English, Yoruba", price: 5000, slots: ["Tomorrow 10:00 AM", "Fri 2:00 PM", "Sat 11:00 AM"], pal: "a" },
  { id: "t3", name: "Mrs Hauwa Bello", role: "Marriage and family therapist", tags: ["Marriage", "Grief"], lang: "English, Hausa", price: 6000, slots: ["Today 6:30 PM", "Fri 5:00 PM", "Sat 9:00 AM"], pal: "c" },
  { id: "t4", name: "Dr Efe Okoro", role: "Counselling psychologist", tags: ["Anxiety", "Trauma"], lang: "English, Pidgin", price: 7000, slots: ["Fri 2:00 PM", "Sat 1:00 PM", "Mon 4:00 PM"], pal: "e" },
];
export const PRO_FILTERS = ["All", "Marriage", "Addiction", "Trauma", "Anxiety", "Grief"];

export type LibItem = { id: string; type: "Book" | "Read" | "Audio"; title: string; blurb: string; len: string; price: string; pal: "a" | "b" | "c" | "d" | "e" };
export const LIB: LibItem[] = [
  { id: "b1", type: "Book", title: "Small Small Healing", blurb: "A gentle guide to starting again after a hard season.", len: "E-book · 42 pages", price: "₦2,000", pal: "d" },
  { id: "b2", type: "Book", title: "After the Bet", blurb: "Plain talk on breaking the betting cycle, one day at a time.", len: "E-book · 36 pages", price: "₦1,500", pal: "a" },
  { id: "r1", type: "Read", title: "What to say when you don’t know what to say", blurb: "A short read on supporting someone who is hurting.", len: "5 min read", price: "Free", pal: "c" },
  { id: "r2", type: "Read", title: "Planning a safe exit: a checklist", blurb: "Practical steps to think through, at your own pace.", len: "7 min read", price: "Free", pal: "b" },
  { id: "a1", type: "Audio", title: "Three minutes of calm", blurb: "A short guided pause for hustle stress.", len: "3 min audio", price: "Free", pal: "e" },
  { id: "a2", type: "Audio", title: "Sleep after a heavy day", blurb: "A slow wind-down to help the mind rest.", len: "10 min audio", price: "Free", pal: "a" },
];
export const LIB_FILTERS = ["All", "Book", "Read", "Audio", "Saved"];

export const TOOLS = [
  { id: "breathe", name: "Breathe", sub: "One minute, box breathing", icon: "≋" },
  { id: "ground", name: "Ground yourself", sub: "The 5-4-3-2-1 steps", icon: "✦" },
  { id: "journal", name: "Journal", sub: "A private place to write", icon: "✎" },
  { id: "safety", name: "Quick exit", sub: "Hide this screen fast", icon: "⏻" },
] as const;

export const GROUND: [string, string, string][] = [
  ["5", "things you can see", "Look around slowly and name five things you can see."],
  ["4", "things you can feel", "Notice four things you can touch or feel, like your feet on the floor."],
  ["3", "things you can hear", "Listen for three sounds, near and far."],
  ["2", "things you can smell", "Find two smells. Or remember two you like."],
  ["1", "thing you can taste", "Notice one taste, then take one slow breath."],
];
export const PROMPTS = [
  "What is one thing you needed to say today?",
  "Name one small thing that went okay.",
  "What would you tell a friend in your shoes?",
  "What is weighing on you most right now?",
];
export const AFFIRM = [
  "You showed up today. That counts.",
  "Small small, one day at a time.",
  "Your story is yours. Share only what you want.",
  "Rest is not giving up.",
  "Asking for help is strength.",
  "You are more than your worst day.",
];
export const MOODS = ["Heavy", "Low", "Okay", "Good", "Great"];
export const MOOD_MSG = [
  "That sounds heavy. You don’t have to carry it alone.",
  "Low days happen. One small step can help.",
  "Okay is okay. Want to sit with a group for a while?",
  "Good to hear. Hold on to that feeling.",
  "Wonderful. Share some of that light in a room.",
];
export const money = (n: number) => "₦" + n.toLocaleString("en-US");
