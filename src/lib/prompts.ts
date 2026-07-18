// Prompt templates — verbatim from BUILD.md §9.1. Templates are wrapped
// client-side, so the router only sees the fully-assembled prompt (server
// stays generic). Do NOT edit these strings without also editing BUILD.md.

/** Six-part GATE tutor template (Groq / Gemini). Used by /doubt. */
export function quickExplainPrompt(args: {
  topic: string;
  currentUnderstanding: string;
  stuckPoint: string;
}): string {
  return `You are a GATE CS tutor. The user is preparing for GATE 2027 (India, computer science). Respond in ONE reply covering all six sections. No preamble. No emojis.

TOPIC: ${args.topic}
USER'S CURRENT UNDERSTANDING: ${args.currentUnderstanding}
USER'S STUCK POINT: ${args.stuckPoint}

Cover in this exact order with these headings:

## 1. Formal definition and intuition
## 2. All variations, edge cases, and boundary conditions
## 3. Common GATE question patterns (1-mark and 2-mark)
## 4. Three worked examples of increasing difficulty
## 5. Common mistakes and trap answers examiners set
## 6. Related concepts to revise next

Be precise. Use LaTeX for math. No filler.`;
}

/** Deep-doubt variant — same body; router adds a "think step-by-step" system prefix. */
export function deepDoubtPrompt(args: {
  topic: string;
  currentUnderstanding: string;
  stuckPoint: string;
}): string {
  return quickExplainPrompt(args);
}

/** F4.4 — five same-concept variations from a source question. */
export function variationPrompt(questionText: string): string {
  return `Given this GATE CS PYQ, generate exactly 5 variations that test the SAME underlying concept but with different numbers, wording, or edge conditions. Number them 1-5. Do not include the answer. Do not include hints. No preamble.

Original question:
${questionText}

Rules:
- Each variation must be independently solvable.
- Vary at least one of: numeric values, boundary conditions (e.g. byte↔word addressable), representation (e.g. little↔big endian), or which quantity is unknown.
- Match GATE tone: terse, unambiguous, no trick unless the concept is a trick.`;
}

/** F4.5 — structured formula extraction. LLM returns JSON only. */
export function formulaExtractPrompt(text: string): string {
  return `Extract every formula from the following text as a JSON array. Each item: {"name": string, "expression": string, "when_to_use": string}. Do not include narrative — output valid JSON only. If no formulas found, return [].

Text:
${text}`;
}

/**
 * Image-based extraction. Vision model (Gemini) reads an image (photo of a
 * page, whiteboard, or PDF snippet), transcribes every formula as LaTeX inside
 * the `expression` field, and returns strict JSON — no code fences, no prose,
 * no commentary. Prompt is deliberately verbose about math preservation so the
 * transcription doesn't lose subscripts / summation bounds / limits.
 */
export function formulaExtractImagePrompt(): string {
  return `You are a math-transcription tool. The image contains formulas from a computer-science / mathematics reference. Extract EVERY distinct formula visible.

Output STRICT JSON only — no markdown, no code fences, no leading or trailing text. The response MUST parse with JSON.parse(). Shape:

[
  {
    "name": "short human name for the formula (e.g. 'Master theorem case 2')",
    "expression": "the formula, in LaTeX. Preserve every subscript, superscript, sum/integral bound, limit, and boundary condition exactly as written.",
    "when_to_use": "one clean sentence — when this formula applies and what problem it solves"
  }
]

Rules — non-negotiable:
- Use LaTeX for "expression". Wrap Greek letters as \\alpha, \\beta, etc. Use \\sum, \\prod, \\int, \\lim, \\frac{a}{b}, \\sqrt{x}, \\log, \\ln, \\binom{n}{k}.
- Preserve subscripts and superscripts. x_i not xi. a^n not a^n typed inline. Use \\sum_{i=1}^{n} not \\sum i=1 to n.
- If a formula has two variants (e.g. discrete vs. continuous, base case vs. recursive), emit two entries.
- If a formula is stated with bounds or a condition (e.g. "for n \\geq 1"), include the condition inside "expression" as \\text{ for } n \\geq 1.
- Do NOT invent formulas that are not visible. Do NOT summarise. Do NOT add explanations to "expression" — that belongs in "when_to_use".
- If the image contains no math, return exactly: []
- If a formula is ambiguous or cut off, skip it rather than guessing.

Return only the JSON array.`;
}

/** F4.6 — Cerebras single-word reflex judge. */
export function reflexScorePrompt(args: {
  phrase: string;
  canonical: string;
  userAnswer: string;
}): string {
  return `GATE trigger phrase reflex check. Respond with ONE WORD only: "MATCH" or "MISS".

Phrase: ${args.phrase}
Canonical concept: ${args.canonical}
User's answer: ${args.userAnswer}

MATCH if the user's answer names the same concept (allow synonyms, abbreviations, minor wording differences). Else MISS.`;
}

/** F5.1 step 5 — weekly synthesis. Data is stringified JSON. */
export function weeklySynthesisPrompt(args: {
  weekStart: string;
  rootCauseSummary: string;
  weakestConcept: string;
  thisWeeksFix: string;
  dataJson: string;
}): string {
  return `You are analyzing a GATE aspirant's PYQ tags for the week of ${args.weekStart}. The user has ALREADY written their own root-cause conclusion below. Your job is to offer a SECOND OPINION — do not repeat the user, do not agree by default, do not flatter. If you see the same weakness, name it in one line. If you see a different upstream weakness in the data, name that instead.

USER'S OWN CONCLUSION:
- Root cause summary: ${args.rootCauseSummary}
- Weakest concept: ${args.weakestConcept}
- This week's fix: ${args.thisWeeksFix}

RAW DATA (aggregated):
${args.dataJson}

Respond in exactly this format:
## Agreement / disagreement
[one sentence]
## The upstream node I see
[one sentence — the ONE concept]
## Why (from the data)
[2-3 sentences citing counts]
## What I would do differently this week
[one sentence, actionable]`;
}

/** Parses reflex_score response into MATCH / MISS / unknown. */
export function parseReflexResult(text: string): 'MATCH' | 'MISS' | null {
  const t = text.trim().toUpperCase();
  if (t.startsWith('MATCH')) return 'MATCH';
  if (t.startsWith('MISS')) return 'MISS';
  return null;
}

export interface ExtractedFormula {
  name: string;
  expression: string;
  when_to_use: string;
}

/**
 * Robust JSON parse for formula extraction responses. Handles:
 *   - leading / trailing whitespace and prose
 *   - ```json ... ``` and plain ``` fences
 *   - responses that start with a stray "Here is the JSON:" preamble
 *   - a single-object response (wrapped into a 1-element array)
 *   - keys reported with different but equivalent casing (`whenToUse` etc.)
 * Rows with missing / non-string fields are dropped, not repaired.
 */
export function parseFormulaExtraction(text: string): ExtractedFormula[] {
  if (!text || typeof text !== 'string') return [];

  // Pull out the first JSON structure we can find. Prefer an array; fall back
  // to a single object.
  const candidates = extractJsonCandidates(text);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      const cleaned = rows
        .map((row) => normaliseRow(row))
        .filter((row): row is ExtractedFormula => row !== null);
      if (cleaned.length > 0) return cleaned;
      // If it parsed to an empty array, that's a valid "no formulas" response.
      if (Array.isArray(parsed) && parsed.length === 0) return [];
    } catch {
      // Try the next candidate.
    }
  }
  return [];
}

function extractJsonCandidates(text: string): string[] {
  const stripped = text
    .replace(/^\s*Here is (?:the )?(?:JSON|response)[:.]?\s*/i, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  const candidates: string[] = [stripped];
  // Find the first '[' and its matching ']'; also the first '{' and its '}'.
  const firstArr = stripped.indexOf('[');
  const lastArr = stripped.lastIndexOf(']');
  if (firstArr !== -1 && lastArr > firstArr) {
    candidates.push(stripped.slice(firstArr, lastArr + 1));
  }
  const firstObj = stripped.indexOf('{');
  const lastObj = stripped.lastIndexOf('}');
  if (firstObj !== -1 && lastObj > firstObj) {
    candidates.push(stripped.slice(firstObj, lastObj + 1));
  }
  return candidates;
}

function normaliseRow(row: unknown): ExtractedFormula | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const name = pickString(r, ['name', 'Name', 'title']);
  const expression = pickString(r, ['expression', 'Expression', 'formula', 'latex']);
  const when = pickString(r, [
    'when_to_use',
    'whenToUse',
    'when',
    'usage',
    'use_case',
    'useCase'
  ]);
  if (!name || !expression || !when) return null;
  return {
    name: name.trim(),
    expression: expression.trim(),
    when_to_use: when.trim()
  };
}

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return null;
}

/** F4.4 — parse the "1. ... 2. ... 3. ..." numbered variations block. */
export function parseVariations(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let buffer = '';
  for (const line of lines) {
    const start = /^\s*(\d+)[.)]\s+/.exec(line);
    if (start) {
      if (buffer.trim()) out.push(buffer.trim());
      buffer = line.replace(/^\s*\d+[.)]\s+/, '');
    } else if (buffer) {
      buffer += `\n${line}`;
    }
  }
  if (buffer.trim()) out.push(buffer.trim());
  return out.slice(0, 5);
}
