// Narrow Supabase mirror for Planner study sessions. The rest of DayPlan stays
// local-only; this is the minimum server data required for Telegram delivery.
import { supabase } from '@/lib/supabase';
import type { StudySession } from '@/lib/planner-storage';

export interface CloudDayPlan {
  date: string;
  sessions: StudySession[];
  updatedAt: string;
}

interface CloudDayPlanRow {
  plan_date: string;
  sessions: unknown;
  updated_at: string;
}

function isStudySession(value: unknown): value is StudySession {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.subject === 'string' &&
    typeof row.durationMin === 'number' &&
    typeof row.mode === 'string' &&
    typeof row.priority === 'string' &&
    typeof row.target === 'string'
  );
}

export async function loadCloudDayPlan(
  userId: string,
  date: string
): Promise<{ plan: CloudDayPlan | null; error: string | null }> {
  const { data, error } = await supabase
    .from('planner_day_plans')
    .select('plan_date, sessions, updated_at')
    .eq('user_id', userId)
    .eq('plan_date', date)
    .maybeSingle();

  if (error) return { plan: null, error: error.message };
  if (!data) return { plan: null, error: null };

  const row = data as CloudDayPlanRow;
  const sessions = Array.isArray(row.sessions)
    ? row.sessions.filter(isStudySession).slice(0, 24)
    : [];
  return {
    plan: { date: row.plan_date, sessions, updatedAt: row.updated_at },
    error: null
  };
}

export async function saveCloudDayPlan(
  userId: string,
  plan: CloudDayPlan
): Promise<string | null> {
  const { error } = await supabase.from('planner_day_plans').upsert(
    {
      user_id: userId,
      plan_date: plan.date,
      sessions: plan.sessions.slice(0, 24),
      updated_at: plan.updatedAt
    },
    { onConflict: 'user_id,plan_date' }
  );
  return error?.message ?? null;
}

export async function deleteCloudDayPlan(
  userId: string,
  date: string
): Promise<string | null> {
  const { error } = await supabase
    .from('planner_day_plans')
    .delete()
    .eq('user_id', userId)
    .eq('plan_date', date);
  return error?.message ?? null;
}
