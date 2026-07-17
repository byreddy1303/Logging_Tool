import type { Outcome, RootCause, MarkDecision } from '@/types';

export const SUBJECTS = [
  'Discrete Mathematics',
  'Engineering Mathematics',
  'Digital Logic',
  'COA',
  'Programming & DS',
  'Algorithms',
  'Theory of Computation',
  'Compiler Design',
  'Operating Systems',
  'Databases',
  'Computer Networks',
  'General Aptitude'
] as const;

export interface OutcomeSpec {
  code: Outcome;
  key: string;
  label: string;
  hint: string;
  /** semantic tone used by badges: ok | slow | guess | wrong */
  tone: 'ok' | 'slow' | 'guess' | 'wrong';
  /** outcomes that feed the re-attempt ladder */
  needsReattempt: boolean;
}

export const OUTCOMES: OutcomeSpec[] = [
  {
    code: 'R',
    key: 'r',
    label: 'Right',
    hint: 'Clean solve, in time',
    tone: 'ok',
    needsReattempt: false
  },
  {
    code: 'RBS',
    key: 's',
    label: 'Right, but slow',
    hint: 'Correct — over target time',
    tone: 'slow',
    needsReattempt: true
  },
  {
    code: 'RBG',
    key: 'g',
    label: 'Right, by guess',
    hint: 'Correct — could not justify',
    tone: 'guess',
    needsReattempt: true
  },
  {
    code: 'W-C',
    key: '1',
    label: 'Wrong — concept',
    hint: 'Did not know / misunderstood',
    tone: 'wrong',
    needsReattempt: true
  },
  {
    code: 'W-E',
    key: '2',
    label: 'Wrong — execution',
    hint: 'Knew it, botched the steps',
    tone: 'wrong',
    needsReattempt: true
  },
  {
    code: 'W-R',
    key: '3',
    label: 'Wrong — reading',
    hint: 'Misread the question',
    tone: 'wrong',
    needsReattempt: true
  }
];

export const OUTCOME_BY_CODE: Record<Outcome, OutcomeSpec> = Object.fromEntries(
  OUTCOMES.map((o) => [o.code, o])
) as Record<Outcome, OutcomeSpec>;

/** Keyboard mapping for the outcome step (BUILD.md F2.2). */
export const OUTCOME_KEYS: Record<string, Outcome> = Object.fromEntries(
  OUTCOMES.map((o) => [o.key, o.code])
);

export interface RootCauseSpec {
  value: RootCause;
  key: string;
  label: string;
  hint: string;
}

export const ROOT_CAUSES: RootCauseSpec[] = [
  { value: 'concept', key: '1', label: 'Concept', hint: 'The idea itself was missing or wrong' },
  { value: 'formula', key: '2', label: 'Formula', hint: 'Forgot or misremembered a formula' },
  { value: 'reading', key: '3', label: 'Reading', hint: 'Misread the statement or constraints' },
  { value: 'computation', key: '4', label: 'Computation', hint: 'Arithmetic / algebra slip' },
  { value: 'strategy', key: '5', label: 'Strategy', hint: 'Wrong approach, time sink, bad triage' }
];

export const MARK_DECISIONS: { value: MarkDecision; label: string }[] = [
  { value: 'MARK', label: 'Mark' },
  { value: 'SKIP', label: 'Skip' },
  { value: 'FIFTY_FIFTY', label: '50-50' }
];

export type SourceKind =
  | 'pyq'
  | 'go_quiz'
  | 'go_dpp'
  | 'go_weekly'
  | 'gate_overflow'
  | 'other';

export interface SourceKindSpec {
  value: SourceKind;
  key: string;
  label: string;
  /** Canonical string prefix stored in `questions.source_ref`. */
  refPrefix: string;
}

export const SOURCE_KINDS: SourceKindSpec[] = [
  { value: 'pyq', key: '1', label: 'PYQ', refPrefix: 'PYQ' },
  { value: 'go_quiz', key: '2', label: 'Go Classes Quiz', refPrefix: 'Go Classes Quiz' },
  { value: 'go_dpp', key: '3', label: 'Go Classes DPP', refPrefix: 'Go Classes DPP' },
  { value: 'go_weekly', key: '4', label: 'Go Classes Weekly Quiz', refPrefix: 'Go Classes Weekly Quiz' },
  { value: 'gate_overflow', key: '5', label: 'GATE Overflow', refPrefix: 'GATE Overflow' },
  { value: 'other', key: '6', label: 'Other', refPrefix: 'Other' }
];

export const SOURCE_KIND_BY_VALUE: Record<SourceKind, SourceKindSpec> = Object.fromEntries(
  SOURCE_KINDS.map((s) => [s.value, s])
) as Record<SourceKind, SourceKindSpec>;

/** GATE CS started running two sets in 2014. */
export const PYQ_TWO_SETS_FROM = 2014;

/** Descending list of PYQ years — earliest 35 years back from the last completed exam. */
export function pyqYears(now: Date = new Date()): number[] {
  const currentYear = now.getFullYear();
  const lastExamYear =
    now.getMonth() > 1 || (now.getMonth() === 1 && now.getDate() >= 10) ? currentYear : currentYear - 1;
  const earliest = lastExamYear - 35;
  const out: number[] = [];
  for (let y = lastExamYear; y >= earliest; y--) out.push(y);
  return out;
}

/** Build a canonical `source_ref` string from parsed pieces. */
export function buildSourceRef(
  kind: SourceKind,
  year: number | null,
  set: 1 | 2 | null,
  questionNumber: string | null,
  format: 'MCQ' | 'MSQ' | 'NAT' | null = null
): string {
  const spec = SOURCE_KIND_BY_VALUE[kind];
  const parts: string[] = [spec.refPrefix];
  if (kind === 'pyq' && year != null) {
    const yearPart = set != null ? `${year} Set ${set}` : `${year}`;
    parts.push(yearPart);
  }
  if (questionNumber && questionNumber.trim()) parts.push(questionNumber.trim());
  if (format) parts.push(format);
  return parts.join(' · ');
}

/** GATE marks a question at 1 or 2 marks; target time roughly tracks that. */
export const MARKS_TARGET_SEC: Record<1 | 2, number> = {
  1: 90,
  2: 180
};

/** GATE question format. MCQ = single-choice, MSQ = multi-select (no negatives), NAT = numeric. */
export type QuestionFormat = 'MCQ' | 'MSQ' | 'NAT';

export interface QuestionFormatSpec {
  value: QuestionFormat;
  label: string;
  hint: string;
}

export const QUESTION_FORMATS: QuestionFormatSpec[] = [
  { value: 'MCQ', label: 'MCQ', hint: 'One correct choice — negative marks apply' },
  { value: 'MSQ', label: 'MSQ', hint: 'Multiple correct — no negative marks' },
  { value: 'NAT', label: 'NAT', hint: 'Numeric answer — no negative marks' }
];

export const TARGET_DURATIONS_MIN = [30, 60, 90, 120] as const;

export const QUESTION_COUNT_CHOICES: { value: number; label: string }[] = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 15, label: '15' },
  { value: 20, label: '20' },
  { value: 65, label: 'Full paper' }
];

export const DEFAULT_TARGET_TIME_SEC = 120;

/** First re-attempt is always scheduled +3 days (ladder D3 → D10 → D30). */
export const REATTEMPT_FIRST_DELAY_DAYS = 3;

export const LLM_DAILY_LIMIT = 100;

export const EXAM_DATE_DEFAULT = '2027-02-06';
