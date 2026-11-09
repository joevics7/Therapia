// Rules shared by the browser and the server.
// A username is turned into a private sign-in address, so no real email or phone is ever collected.
const DOMAIN = process.env.NEXT_PUBLIC_RECOVERY_EMAIL_DOMAIN || "recovery.therapia.invalid";

export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const RESERVED = /(host|facilitator|admin|moderator|therapia|support|system|official|staff)/i;

export const emailFor = (username: string) => `${username.trim().toLowerCase()}@${DOMAIN}`;

export function usernameProblem(u: string): string | null {
  const x = u.trim();
  if (!USERNAME_RE.test(x)) return "Use 3 to 20 letters, numbers or underscores. No spaces.";
  if (RESERVED.test(x)) return "That name can't be used. Try another.";
  return null;
}

export function passwordProblem(p: string): string | null {
  if (p.length < 8) return "Use at least 8 characters.";
  if (p.length > 72) return "That's too long. Use 72 characters or fewer.";
  return null;
}

export const QUESTIONS = [
  "What was the name of your first school?",
  "What is your mother's first name?",
  "In which town or village did you grow up?",
  "What was your childhood nickname?",
  "What was your pet's name when you were a kid?",
  "What is the name of your best childhood friend?",
  "What was your first job?",
  "What is the name of your favourite teacher?",
  "Which state were you born in?",
  "What is your father's first name?",
  "What is your oldest sibling's name?",
  "What was the name of your secondary school?",
  "What was your favourite food as a child?",
  "What is your favourite football club?",
  "What was the name of the street you lived on as a child?",
  "What was your favourite game as a kid?",
  "What was the first phone you ever owned?",
  "What is your grandmother's first name?",
  "What is the name of your favourite uncle or aunty?",
  "What was the name of your first boss?",
  "What was the first song you really loved?",
  "What was your favourite subject at school?",
  "What was the name of your childhood neighbour?",
  "What was the first bike or car you ever owned?",
  "What is your favourite meal that your mother cooks?",
  "What is the name of the town where your parents met?",
];
export const CUSTOM_QUESTION = "Write my own question";

export const normText = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
export const questionProblem = (q: string) => (q.trim().length < 5 || q.trim().length > 120 ? "Use a question of 5 to 120 characters." : null);
export const answerProblem = (a: string) => (a.trim().length < 3 ? "Each answer needs at least 3 characters." : null);

/** Both questions and both answers, checked together. */
export function recoveryProblem(q1: string, a1: string, q2: string, a2: string): string | null {
  return questionProblem(q1) || questionProblem(q2)
    || (normText(q1) === normText(q2) ? "Pick two different questions." : null)
    || answerProblem(a1) || answerProblem(a2);
}
