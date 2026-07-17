// Row types mirror supabase/migrations/20260717000001_initial_schema.sql exactly.
// Nullable Postgres columns are `| null` (Supabase returns null, never undefined).

export type Outcome = 'R' | 'RBS' | 'RBG' | 'W-C' | 'W-E' | 'W-R';
export type RootCause = 'concept' | 'formula' | 'reading' | 'computation' | 'strategy';
export type MarkDecision = 'MARK' | 'SKIP' | 'FIFTY_FIFTY';
export type ReattemptStage = 'D3' | 'D10' | 'D30' | 'MASTERED';
export type ReattemptResult = 'clean' | 'fail';
export type BuddyStatus = 'pending' | 'active' | 'paused';
export type ShareStatus = 'sent' | 'solved' | 'discussed';
export type LlmProvider = 'groq' | 'gemini' | 'openrouter' | 'cerebras';
export type LlmUse =
  | 'quick_explain'
  | 'deep_doubt'
  | 'triangulate'
  | 'long_context'
  | 'reflex_score'
  | 'variation'
  | 'formula_extract'
  | 'weekly_synthesis';
export type InterruptionKind = 'tab_switch' | 'idle' | 'exit';
export type SyncStatus = 'synced' | 'pending' | 'error';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  exam_date: string;
  target_rank: number;
  sadhana_practice: boolean;
  timezone: string;
  created_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  date: string;
  subject: string;
  target_duration_min: number;
  actual_duration_min: number | null;
  insight: string | null;
  sadhana_done: boolean;
  interruptions_count: number;
  created_at: string;
}

export interface QuestionRow {
  id: string;
  user_id: string;
  session_id: string | null;
  subject: string;
  subtopic: string | null;
  source_year: number | null;
  source_ref: string | null;
  question_text: string | null;
  image_url: string | null;
  time_spent_sec: number;
  target_time_sec: number;
  outcome: Outcome;
  pattern_name: string | null;
  trigger_sentence: string | null;
  root_cause: RootCause | null;
  mark_decision: MarkDecision | null;
  mark_correct: boolean | null;
  created_at: string;
}

export interface PatternRow {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  count: number;
  is_reflexed: boolean;
  mastery_level: number;
  first_seen_at: string;
}

export interface ReattemptHistoryEntry {
  date: string;
  result: ReattemptResult;
  timeSpent?: number;
}

export interface ReattemptRow {
  id: string;
  user_id: string;
  question_id: string;
  scheduled_date: string;
  stage: ReattemptStage;
  history: ReattemptHistoryEntry[];
  created_at: string;
}

export interface FormulaRow {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  expression: string;
  forgot_count: number;
  last_reviewed: string | null;
  next_review: string;
  created_at: string;
}

export interface TriggerPhraseRow {
  id: string;
  user_id: string;
  phrase: string;
  concept: string;
  reflex_time_ms: number | null;
  question_ids: string[];
  created_at: string;
}

export interface WeeklyReviewRow {
  id: string;
  user_id: string;
  week_start: string;
  root_cause_summary: string | null;
  weakest_concept: string | null;
  this_weeks_fix: string | null;
  llm_synthesis: string | null;
  created_at: string;
}

export interface InterruptionLogRow {
  id: string;
  user_id: string;
  session_id: string;
  ts: string;
  kind: InterruptionKind;
}

export interface DoubtSessionRow {
  id: string;
  user_id: string;
  question_id: string | null;
  use_case: LlmUse;
  template_used: string | null;
  user_input: string;
  provider: LlmProvider;
  model: string;
  response: string;
  latency_ms: number | null;
  was_helpful: boolean | null;
  created_at: string;
}

export interface VariationRow {
  id: string;
  user_id: string;
  parent_question_id: string;
  generated_text: string;
  added_to_reattempt: boolean;
  created_at: string;
}

export interface TriangulateLogRow {
  id: string;
  user_id: string;
  prompt: string;
  groq_resp: string | null;
  gemini_resp: string | null;
  openrouter_resp: string | null;
  user_conclusion: string | null;
  disagreement_noted: string | null;
  created_at: string;
}

export interface LlmUsageDailyRow {
  user_id: string;
  day: string;
  count: number;
}

export interface BuddyRow {
  id: string;
  user_a: string;
  user_b: string;
  status: BuddyStatus;
  created_at: string;
}

export interface SharedInsightRow {
  id: string;
  user_id: string;
  week_start: string;
  insight: string;
  created_at: string;
}

export interface QuestionShareRow {
  id: string;
  from_user: string;
  to_user: string;
  question_id: string;
  note: string | null;
  status: ShareStatus;
  created_at: string;
}

export interface StudyRoomRow {
  id: string;
  name: string;
  subject: string;
  start_time: string;
  duration_min: number;
  participants: string[];
  created_by: string;
  created_at: string;
}

export interface StudyRoomPresenceRow {
  room_id: string;
  user_id: string;
  joined_at: string;
}

export interface InviteRow {
  id: string;
  token: string;
  issued_by: string;
  used_by: string | null;
  expires_at: string;
  created_at: string;
}

/** Local (Dexie) shape: server row + sync bookkeeping. */
export type Local<T> = T & { sync_status: SyncStatus };
