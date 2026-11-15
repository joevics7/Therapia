/**
 * ONE place to control every AI writer / rewriter in the admin.
 * Change the models here and it applies to articles, templates and tools.
 */

/** Tried in order: primary first, then each fallback. */
export const GEMINI_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
] as const;

/** Default output token budget for all AI calls. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 20000;

export function geminiUrl(model: string, apiKey: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

/** Every Gemini key found in secrets (GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_1, ...). */
export function getGeminiKeys(): string[] {
  const keys = Object.entries(process.env)
    .filter(([name, v]) => /^GEMINI_API/i.test(name) && typeof v === "string" && v.trim())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => (v as string).trim());
  const unique = Array.from(new Set(keys));
  if (unique.length === 0) {
    throw new Error("No Gemini API key set. Add GEMINI_API_KEY (and more) in secrets.");
  }
  return unique;
}

let rotation = 0;

/**
 * Runs `fn` over every model (in order) and every key (rotating start),
 * returning the first success. Throws the last error if all fail.
 */
export async function withGeminiFallback<T>(
  label: string,
  fn: (model: string, apiKey: string) => Promise<T>,
): Promise<T> {
  const keys = getGeminiKeys();
  const start = rotation++ % keys.length;
  const orderedKeys = keys.map((_, i) => keys[(start + i) % keys.length]);
  let lastErr: unknown;
  for (const model of GEMINI_MODELS) {
    for (const key of orderedKeys) {
      try {
        return await fn(model, key);
      } catch (err) {
        lastErr = err;
      }
    }
  }
  throw new Error(
    `${label} failed: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
}
