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
