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

/** Best-effort JSON parse for formula extraction; strips ```json fences. */
export function parseFormulaExtraction(
  text: string
): { name: string; expression: string; when_to_use: string }[] {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r) =>
        r &&
        typeof r === 'object' &&
        typeof r.name === 'string' &&
        typeof r.expression === 'string' &&
        typeof r.when_to_use === 'string'
    );
  } catch {
    return [];
  }
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
