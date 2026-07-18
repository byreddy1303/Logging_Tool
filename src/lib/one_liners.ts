// Curated static one-liners. Deterministic day-based rotation — no streaks,
// no gamification, no dopamine loop (BUILD §2.4). Copy is calm and cognitive,
// aligned with the sunlit-notebook aesthetic: precise, quiet, no exclamation
// marks, no emojis.
//
// Add here, don't sprinkle across components.

export interface OneLiner {
  text: string;
  /** Optional short attribution or context. Kept minimal. */
  attribution?: string;
}

export const ONE_LINERS: OneLiner[] = [
  { text: 'Confusion is data. Log it.' },
  { text: 'The mistake surface shrinks by tagging, not by hoping.' },
  { text: 'A pattern named twice is a pattern owned.' },
  { text: 'Slow-but-clean beats fast-but-guess. Every time.' },
  { text: 'You do not need more questions. You need cleaner tags.' },
  { text: 'A weekly fix is one sentence. Anything longer is drift.' },
  { text: 'Re-attempts are how yesterday teaches today.' },
  { text: 'The trigger phrase either fires or it doesn’t. Time will tell.' },
  { text: 'Formulas forgotten under pressure are formulas untaught.' },
  { text: 'Deep work is boring on the inside and beautiful on the outside.', attribution: 'unknown' },
  { text: 'What you can not tag, you can not fix.' },
  { text: 'One honest wrong answer teaches more than ten guessed right.' },
  { text: 'The exam does not care about your streak. Neither should the tool.' },
  { text: 'The point is not to know more. It is to be wrong less.' },
  { text: 'A calibrated MARK is worth ten hopeful ones.' },
  { text: 'Rank is the shadow. Compress the mistake surface and rank follows.' },
  { text: 'Speed comes from pattern recognition, not from panic.' },
  { text: 'Read the question twice. Tag it once.' },
  { text: 'Every reattempt is a re-education, not a rerun.' },
  { text: 'The tool is a mirror. Own the reflection.' },
  { text: 'Not every session earns an insight. That is fine. Skip it.' },
  { text: 'Small daily loops beat heroic weekend marathons.' },
  { text: 'The Sunday review is where the week actually happens.' },
  { text: 'Your notes tell you what you learned. Your tags tell you what you missed.' },
  { text: 'The most useful chart is the one you sit with.' },
  { text: 'Under time pressure, we solve the question we wish we had.' },
  { text: 'A concept is understood only after it survives three wrong answers.' },
  { text: 'Attention is a currency. Interruptions are the tax.' },
  { text: 'The exam rewards the second-most-obvious idea, more often than not.' },
  { text: 'When two providers disagree, so should you — with both of them.' },
  { text: 'A good root cause fits in one word. If it needs a paragraph, dig further.' },
  { text: 'Reading fast is a defence. Reading twice is a habit.' },
  { text: 'A question you skipped is a question you did not learn from. That is a choice.' },
  { text: 'You are not behind. You are exactly where the data says you are.' },
  { text: 'Master the trigger and the question begins solving itself.' },
  { text: 'Ambient dashboards do not motivate. Repeatable tagging does.' },
  { text: 'The upstream weakness always looks small until you name it.' },
  { text: 'Practice without a tag is a chore. Practice with a tag is a lesson.' },
  { text: 'This tool has one job: make yesterday useful.' },
  { text: 'A quiet day of clean tags is worth a loud day of frantic solving.' }
];

/** Returns the same one-liner for the same (dateISO, userId) pair every time. */
export function pickOneLinerFor(dateISO: string, seed = ''): OneLiner {
  const key = `${dateISO}|${seed}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % ONE_LINERS.length;
  return ONE_LINERS[idx];
}
