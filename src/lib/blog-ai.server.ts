import { z } from "zod";
import { DEFAULT_MAX_OUTPUT_TOKENS, geminiUrl, withGeminiFallback } from "./ai-config.server";

const ExtractSchema = z.object({
  slug: z.string(),
  category_slug: z.string(),
  title: z.string(),
  related_tool_slugs: z.array(z.string()),
  countries: z.array(z.string()),
  excerpt: z.string(),
  meta_description: z.string(),
  reading_time_minutes: z.number().int(),
  cleaned_content: z.string(),
});


async function callGemini(model: string, apiKey: string, prompt: string) {
  const url = geminiUrl(model, apiKey);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
        responseSchema: {
          type: "object",
          properties: {
            slug: { type: "string" },
            category_slug: { type: "string" },
            title: { type: "string" },
            related_tool_slugs: { type: "array", items: { type: "string" } },
            countries: { type: "array", items: { type: "string" } },
            excerpt: { type: "string" },
            meta_description: { type: "string" },
            reading_time_minutes: { type: "integer" },
            cleaned_content: { type: "string" },
          },
          required: [
            "slug",
            "category_slug",
            "title",
            "related_tool_slugs",
            "countries",
            "excerpt",
            "meta_description",
            "reading_time_minutes",
            "cleaned_content",
          ],
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${model} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini ${model}: empty response`);
  return ExtractSchema.parse(JSON.parse(text));
}

const EXTRACT_PROMPT_INSTRUCTIONS = `You are a precise editor. DO NOT rewrite, summarize, paraphrase, or reword the article. You may ONLY make surgical (scissors) edits. Preserve every heading, table, list, blockquote, paragraph, and the author's exact wording.

Return JSON with these fields:

1. "slug" — url slug for the article. If the content or title suggests one, use it; otherwise derive a kebab-case slug from the title (lowercase, hyphens).
2. "category_slug" — one short kebab-case category (e.g. "tax", "compliance", "payroll", "data-protection"). Infer from the content.
3. "title" — the article's H1 / main title as plain text (no markdown).
4. "related_tool_slugs" — array of kebab-case tool slugs mentioned or clearly relevant (e.g. ["salary-calculator", "vat-calculator"]). Empty array if none.
5. "countries" — array of lowercase country names the article is about (e.g. ["nigeria"]). Default ["nigeria"] if unclear.
6. "excerpt" — 1-2 sentence teaser (~200 chars max) drawn from the intro. Plain text, no markdown.
7. "meta_description" — SEO description under 155 chars, plain text.
8. "reading_time_minutes" — integer, based on ~220 words/min.
9. "cleaned_content" — the SAME markdown, with ONLY the following scissors edits applied:

   a. LINK CLEANUP — the source often appends bare citation-style links at the end of sentences like: "automated PDFs for Nigerian businesses. [nitda.gov](https://nitda.gov.ng/...)". These are NOT natural. For every such trailing bare-domain link:
      - Pick at most the 5 BEST, most authoritative external links across the WHOLE article (prefer official gov sites and primary sources). Delete every other trailing bare-domain citation entirely, including any leading space or stray punctuation orphaned by the removal — but keep the surrounding sentence intact.
      - For the kept 5, rewrite them as inline anchors integrated naturally into the nearest preceding sentence. Do this by turning a relevant NOUN PHRASE already in that sentence into the anchor text — e.g. change "automated PDFs for Nigerian businesses. [nitda.gov](https://nitda.gov.ng/x)" into "automated PDFs for [Nigerian businesses](https://nitda.gov.ng/x)." Do NOT invent new sentences or add commentary. If no reasonable noun phrase exists, drop that link too.
      - Internal links (relative paths, same-site) are not counted against the 5-link cap; keep them and also inline them naturally the same way if they appear as trailing bare-domain citations.

   b. REMOVE AI COMMENTARY — the source often contains meta commentary aimed at the human editor. Remove all of the following completely:
      - Word-count notes: "(Word count: 1,240)", "**Word count:** ...", "Total words: ..."
      - Placeholders/notes: "TK", "TODO", "[insert stat here]"
      - Meta explanations of keywords/headings/SEO choices ("This heading targets the keyword ...", "I chose this title because ...", "Note to editor: ...")
      - Preambles/sign-offs: "Here is the article:", "Below is the rewritten piece:", "Let me know if you want ...", "I hope this helps ..."
      - Stray HTML tags that don't belong, duplicated headings, leftover prompt fragments

   c. Do NOT change any other wording. If a paragraph has no defects, return it verbatim.

TITLE (may be empty):
{{TITLE}}

CONTENT:
{{CONTENT}}`;

function buildPrompt(title: string, content: string) {
  return EXTRACT_PROMPT_INSTRUCTIONS.replace("{{TITLE}}", title || "").replace(
    "{{CONTENT}}",
    content,
  );
}

export async function runExtraction(title: string, content: string) {
  const prompt = buildPrompt(title, content);
  return withGeminiFallback("AI extraction", (model, key) => callGemini(model, key, prompt));
}
