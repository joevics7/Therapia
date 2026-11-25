/** What people can say they need help with. The ids are also allowed in the database (user_needs and motivations.topics). */
export const NEEDS = [
  { id: "betting", label: "Betting", emoji: "🎲" },
  { id: "marriage", label: "Marriage or relationship problems", emoji: "💍" },
  { id: "abuse", label: "Abuse or violence at home", emoji: "🛡️" },
  { id: "anger", label: "Anger", emoji: "🔥" },
  { id: "grief", label: "Grief and loss", emoji: "🕊️" },
  { id: "addiction", label: "Alcohol or drugs", emoji: "🍾" },
  { id: "money", label: "Money stress", emoji: "💸" },
  { id: "anxiety", label: "Anxiety or panic", emoji: "🌀" },
  { id: "depression", label: "Low mood or depression", emoji: "🌧️" },
  { id: "heartbreak", label: "Heartbreak", emoji: "💔" },
  { id: "work", label: "Job or career stress", emoji: "💼" },
  { id: "other", label: "Something else", emoji: "✨" },
] as const;
export type NeedId = (typeof NEEDS)[number]["id"];
export const NEED_IDS: string[] = NEEDS.map((n) => n.id);
export const needLabel = (id: string) => NEEDS.find((n) => n.id === id)?.label ?? id;
