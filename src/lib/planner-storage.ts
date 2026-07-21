// localStorage helpers for the calendar-based Planner. Kept isolated so we
// can migrate to Dexie/Supabase later without touching the UI.
//
// Storage keys:
//   planner_YYYY-MM-DD                 → DayPlan for that date

const DAY_KEY_PREFIX = 'planner_';

/* ------------------------------ types ------------------------------ */

export type StudyMode =
  | 'Deep Study'
  | 'Revision'
  | 'Problem Solving'
  | 'PYQ Practice'
  | 'Mock Test'
  | 'Lecture Watch'
  | 'Note Making'
  | 'Doubt Clearing';

export type Priority = 'P1 Critical' | 'P2 High' | 'P3 Medium' | 'P4 Low';

export type BreakPattern = 'p25' | 'p50' | 'p90' | 'custom' | 'flexible';

export type DayType =
  | 'Full Study Day'
  | 'Half Day'
  | 'Light Day'
  | 'Mock Test Day'
  | 'Rest/Recovery Day'
  | 'Travel Day'
  | 'Exam Day';

export type EnergyForecast = 'high' | 'medium' | 'low' | 'recovery';

/** End-of-day mood identifier. UI maps these to emoji renderings; the
 *  storage layer keeps stable non-emoji strings so the codebase stays clean
 *  under the no-emoji lint rule (BUILD.md §2.7). */
export type EndMood = 'drained' | 'flat' | 'ok' | 'strong' | 'fired_up';

export type Replicate = 'yes' | 'partial' | 'no';

export interface StudySession {
  id: string;
  subject: string;
  /** When subject === 'Custom...' the free-text name lives here. */
  customSubject?: string;
  /** Planned duration in minutes. */
  durationMin: number;
  mode: StudyMode;
  priority: Priority;
  target: string;
  resource?: string;
}

export interface DayStructure {
  wakeAt: string;
  sleepAt: string;
  totalHoursTarget: number;
  breakPattern: BreakPattern;
  customBreak?: string;
  dayType: DayType;
}

export interface Mindset {
  energyForecast: EnergyForecast;
  moodIntent: string;
  motivationNote: string;
}

export interface NonStudy {
  exerciseDone: boolean;
  exerciseTime: string;
  errands: string;
  social: string;
}

export interface Review {
  completionPct: number;
  wentWell: string;
  missed: string;
  endMood: EndMood | '';
  replicate: Replicate | '';
}

export interface DayPlan {
  date: string; // YYYY-MM-DD
  sessions: StudySession[];
  structure: DayStructure;
  mindset: Mindset;
  nonStudy: NonStudy;
  review: Review;
  updatedAt: string;
}

/* ------------------------------ defaults ------------------------------ */

export function emptyDayPlan(date: string): DayPlan {
  return {
    date,
    sessions: [],
    structure: {
      wakeAt: '06:00',
      sleepAt: '23:00',
      totalHoursTarget: 6,
      breakPattern: 'p50',
      dayType: 'Full Study Day'
    },
    mindset: {
      energyForecast: 'high',
      moodIntent: 'Focused Grind',
      motivationNote: ''
    },
    nonStudy: {
      exerciseDone: false,
      exerciseTime: '',
      errands: '',
      social: ''
    },
    review: {
      completionPct: 0,
      wentWell: '',
      missed: '',
      endMood: '',
      replicate: ''
    },
    updatedAt: new Date().toISOString()
  };
}

/* --------------------------- read / write ---------------------------- */

function safeGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded — best-effort only.
  }
}

export function keyFor(date: string): string {
  return `${DAY_KEY_PREFIX}${date}`;
}

export function loadDayPlan(date: string): DayPlan | null {
  return safeGet<DayPlan>(keyFor(date));
}

export function saveDayPlan(plan: DayPlan): void {
  safeSet(keyFor(plan.date), { ...plan, updatedAt: new Date().toISOString() });
}

export function deleteDayPlan(date: string): void {
  try {
    localStorage.removeItem(keyFor(date));
  } catch {
    // ignore
  }
}

/* ----------------------- calendar bulk queries ----------------------- */

/** Return a Set of YYYY-MM-DD keys that have a plan stored. */
export function loadPlanIndexForMonth(year: number, monthIndex: number): Set<string> {
  const set = new Set<string>();
  const prefix = `${DAY_KEY_PREFIX}${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(prefix)) set.add(k.slice(DAY_KEY_PREFIX.length));
    }
  } catch {
    // ignore
  }
  return set;
}

/** Quick per-day summary for the calendar cell chips. */
export interface DayCellSummary {
  subjects: string[];
  totalMin: number;
}

export function summarize(plan: DayPlan | null): DayCellSummary {
  if (!plan) return { subjects: [], totalMin: 0 };
  const subjects: string[] = [];
  let totalMin = 0;
  for (const s of plan.sessions) {
    const label =
      s.subject === 'Custom...' && s.customSubject ? s.customSubject : s.subject;
    if (label && !subjects.includes(label)) subjects.push(label);
    totalMin += s.durationMin || 0;
  }
  return { subjects, totalMin };
}
