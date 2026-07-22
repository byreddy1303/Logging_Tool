import { describe, expect, it } from 'vitest';
import type { QuestionRow } from '@/types';
import { buildLearningTips } from '@/lib/learning-tips';

function question(overrides: Partial<QuestionRow> = {}): QuestionRow {
  return {
    id: 'question-1',
    user_id: 'user-1',
    session_id: null,
    subject: 'Operating Systems',
    subtopic: null,
    source_year: null,
    source_ref: null,
    question_text: null,
    answer_text: null,
    image_url: null,
    time_spent_sec: 60,
    target_time_sec: 120,
    outcome: 'R',
    pattern_name: null,
    trigger_sentence: null,
    root_cause: null,
    mark_decision: null,
    mark_correct: null,
    created_at: '2026-07-21T08:00:00.000Z',
    ...overrides
  };
}

describe('buildLearningTips', () => {
  it('puts due retrieval first and links to the queue', () => {
    const tips = buildLearningTips({
      due: 3,
      weeklyFix: null,
      lastSessionQuestions: [],
      sessionsThisWeek: 0,
      questionsToday: 0
    });
    expect(tips[0]).toMatchObject({ id: 'due-first', href: '/reattempts' });
  });

  it('turns observed reading and execution errors into concrete advice', () => {
    const tips = buildLearningTips({
      due: 0,
      weeklyFix: null,
      lastSessionQuestions: [
        question({ id: 'reading', outcome: 'W-R' }),
        question({ id: 'execution', outcome: 'W-E' })
      ],
      sessionsThisWeek: 1,
      questionsToday: 2
    });
    expect(tips.map((tip) => tip.id)).toEqual(
      expect.arrayContaining(['reading-errors', 'execution-errors'])
    );
  });

  it('shows a useful default when there is no learner data', () => {
    const [tip] = buildLearningTips({
      due: 0,
      weeklyFix: null,
      lastSessionQuestions: [],
      sessionsThisWeek: 0,
      questionsToday: 1
    });
    expect(tip.id).toBe('default-retrieval');
  });

  it('caps the dashboard carousel at four notes', () => {
    const tips = buildLearningTips({
      due: 2,
      weeklyFix: 'Redo cache mapping PYQs',
      lastSessionQuestions: [
        question({ outcome: 'W-R' }),
        question({ outcome: 'W-E' }),
        question({ outcome: 'W-C' }),
        question({ outcome: 'RBG' }),
        question({ outcome: 'RBS' })
      ],
      sessionsThisWeek: 2,
      questionsToday: 0
    });
    expect(tips).toHaveLength(4);
  });
});
