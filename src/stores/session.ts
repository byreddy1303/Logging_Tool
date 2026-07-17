// Runtime state of the active session. Durable facts (session row, tagged
// questions) live in Dexie; this holds only what is ephemeral by design:
// planned question count (DECISIONS.md — no schema column) and the current
// question's start timestamp so in-app navigation never resets the timer.
import { create } from 'zustand';

interface SessionRunState {
  sessionId: string | null;
  plannedCount: number;
  questionStartedAt: number | null;
  begin: (sessionId: string, plannedCount: number) => void;
  startQuestion: () => void;
  end: () => void;
}

export const useSessionStore = create<SessionRunState>((set) => ({
  sessionId: null,
  plannedCount: 0,
  questionStartedAt: null,
  begin: (sessionId, plannedCount) => set({ sessionId, plannedCount, questionStartedAt: Date.now() }),
  startQuestion: () => set({ questionStartedAt: Date.now() }),
  end: () => set({ sessionId: null, plannedCount: 0, questionStartedAt: null })
}));
