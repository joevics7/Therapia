// Verified helplines. Checked 9 Nov 2026 against findahelpline.com, SURPIN's page on lifeline-international.com
// and the national emergency directory on pulse.ng. Numbers change: re-check before launch and every few months.
export const HELP_CHECKED = "9 Nov 2026";

export type Line = { name: string; number: string; note: string };
export type HelpGroup = { title: string; lines: Line[] };

export const EMERGENCY: Line = { name: "Emergency services", number: "112", note: "Free, national. Police: 199" };

export const HELP_GROUPS: HelpGroup[] = [
  {
    title: "Thoughts of ending your life, or feeling overwhelmed",
    lines: [
      { name: "SURPIN helpline", number: "08000787746", note: "Free, 24 hours" },
      { name: "MANI helpline", number: "08091116264", note: "Free" },
      { name: "Asido Foundation", number: "+2349028080416", note: "Psychological first aid, also by SMS" },
    ],
  },
  {
    title: "Abuse at home or sexual violence",
    lines: [
      { name: "DSVRT, Lagos", number: "08003333333", note: "Free. Domestic and sexual violence response" },
      { name: "Women Safe House", number: "+2348121133399", note: "24 hours. Women and girls" },
    ],
  },
  { title: "A child in danger", lines: [{ name: "Cece Yara child helpline", number: "08008008001", note: "24 hours" }] },
  { title: "Gambling that is out of control", lines: [{ name: "Gamble Alert", number: "+2349162957989", note: "Support for gambling harm" }] },
];

// What a host does when someone in the room is in crisis. Shown on the host page.
export const CRISIS_STEPS = [
  "Stay calm and keep your voice steady. Do not end the session suddenly.",
  "Say what you heard, kindly and plainly. Ask directly: are you thinking about ending your life?",
  "Do not promise to keep a safety risk secret. Say you want them to get proper help.",
  "Read out the helplines from the Need help now button, and ask them to call one now. If they are in immediate danger, ask them to call 112 or go to someone nearby.",
  "If you can, ask a co-host or listener to keep the group going while you stay with the person.",
  "Afterwards, write down what happened without any names or details that could identify anyone, and tell the Therapia owner. Look after yourself too.",
];
