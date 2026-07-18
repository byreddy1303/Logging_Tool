// 30 GATE-focused, ruthless motivational quotes rotated daily.
//
// Tone: cocky, savage, no-excuses. Assumes reader wants AIR < 100 and knows
// what that costs. Never generic self-help. Always about DOING the work.

export const MOTIVATIONAL_QUOTES: readonly string[] = [
  "AIR 1 doesn't sleep in. Your competition does. Get up.",
  'You either dominate the GATE or you explain why you didn\'t. Pick one.',
  'Mediocre students watch lectures. Top rankers solve problems until it bleeds.',
  'Your rank next year is being decided right now. What are you doing about it?',
  'Comfort is the enemy. Open Rosen. Now.',
  'Every hour you scroll, someone else solves 12 more PYQs. The gap widens.',
  'Nobody remembers AIR 4000. Nobody. Make sure your name is worth remembering.',
  'You don\'t need motivation. You need a chair, a book, and shame.',
  'The syllabus is finite. Your excuses are not. Kill them.',
  'One more problem. That\'s the difference between AIR 100 and AIR 1000.',
  'DBMS is not going to teach itself. Neither is TOC. Neither is anything.',
  'You promised yourself IIT last year. What have you done today to deserve it?',
  'Study when it\'s hard. Everyone studies when it\'s easy.',
  'Your notebooks are pretty. Your marks are not. Change what matters.',
  'Compilers, OS, CN, DS — pick your weakness and murder it before lunch.',
  'The clock doesn\'t care about your mood. Solve problems anyway.',
  'Coaching won\'t save you. Notes won\'t save you. Only you save you.',
  'That YouTube "10-hour study with me" is not studying. Sit down and DO it.',
  'Every PYQ you skip is a mark someone else banks. Don\'t donate ranks.',
  'You want an offer letter, not sympathy. Act like it.',
  'Two years from now, you\'ll wish you\'d started this session sooner. Start now.',
  'Weak in Aptitude? Fix it in 30 days or lose 15 marks. That\'s the math.',
  'Discipline is choosing between what you want now and what you want most.',
  'If you can\'t sit for 4 hours straight, you can\'t sit for a 3-hour exam. Train.',
  'Excuses are the language of AIR > 5000. Learn a new language.',
  'The topper of GATE 2025 studied while you were "planning to start Monday".',
  'One weak subject cripples your rank. There\'s no "carrying" in an OMR sheet.',
  'Reading solutions is not solving. Close the book. Redo the problem cold.',
  'Toppers don\'t "feel motivated". They just show up and work. Every. Single. Day.',
  'You wanted this. You planned this. Now execute this — no excuses.'
] as const;

/** Deterministic quote for a given date so the daily digest is stable. */
export function quoteForDate(dateISO: string): string {
  // Hash YYYY-MM-DD → non-negative int → mod quotes length.
  let h = 0;
  for (let i = 0; i < dateISO.length; i++) {
    h = (h * 31 + dateISO.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % MOTIVATIONAL_QUOTES.length;
  return MOTIVATIONAL_QUOTES[idx];
}

/** Random one — used by the "send now" button when the user wants variety. */
export function randomQuote(): string {
  const idx = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
  return MOTIVATIONAL_QUOTES[idx];
}
