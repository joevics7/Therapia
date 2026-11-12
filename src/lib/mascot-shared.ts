// Shared between the browser and the server.
export const MASCOT_NAME = "Ava";
/** A fixed id for the mascot's messages. It is not a member of any group. */
export const MASCOT_ALIAS = "00000000-0000-0000-0000-00000000a1a1";
/** @Ava or @mascot anywhere in a message calls the mascot. */
export const TAG_RE = /@(ava|mascot)\b/i;
export const isQuestion = (s: string) => s.includes("?");
