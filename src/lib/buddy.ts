import type { BuddyMessageRow, QuestionRow, SharedQuestionRef } from '@/types';

/** Strip a journal row to the only fields that may cross into Buddy. */
export function safeQuestionRef(question: QuestionRow): SharedQuestionRef {
  return {
    subject: question.subject,
    subtopic: question.subtopic,
    question_text: question.question_text,
    image_url: question.image_url,
    source_ref: question.source_ref,
    source_year: question.source_year,
    target_time_sec: question.target_time_sec,
    origin_question_id: question.id
  };
}

/** Merge optimistic and realtime rows without duplicates, in display order. */
export function mergeBuddyMessages(
  previous: BuddyMessageRow[],
  incoming: BuddyMessageRow[]
): BuddyMessageRow[] {
  if (incoming.length === 0) return previous;
  const byId = new Map<string, BuddyMessageRow>();
  for (const message of previous) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function isSharedQuestionRef(value: unknown): value is SharedQuestionRef {
  if (!value || typeof value !== 'object') return false;
  const ref = value as Partial<SharedQuestionRef>;
  return typeof ref.subject === 'string' && typeof ref.target_time_sec === 'number';
}
