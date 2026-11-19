// Static content for the tools. Therapists, groups, blog posts and audio live in the database and are edited in /admin.

export const TOOLS = [
  { id: "breathe", name: "Breathe", sub: "One minute, box breathing", icon: "≋" },
  { id: "ground", name: "Ground yourself", sub: "The 5-4-3-2-1 steps", icon: "✦" },
  { id: "journal", name: "Journal", sub: "A private place to write", icon: "✎" },
  { id: "morning", name: "Morning message", sub: "A daily lift, with a reminder", icon: "☀" },
  { id: "meditate", name: "Meditate", sub: "Guided audio to reset", icon: "☾" },
  { id: "sleep", name: "Sleep", sub: "Audio to wind down", icon: "☁" },
  { id: "betting", name: "Betting plan", sub: "Cut down step by step", icon: "◐" },
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
