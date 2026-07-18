// The Dashboard opening: name greeting + calm one-liner + ambient weekly read.
// Sets the mood without ever pinging for engagement:
//   - Greeting is time-of-day aware, uses the user's first name.
//   - One-liner rotates deterministically per day (no streak / no dopamine).
//   - "This week's read" fetches from weekly-insight edge fn; cached per day.
//
// Design (BUILD §10 sunlit-notebook): warm paper card, red-pen margin line,
// vermilion accent, highlighter underline on the read sentence.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { RefreshCcw, Sparkles } from 'lucide-react';
import { formatDate, todayISO } from '@/lib/utils';
import { pickOneLinerFor } from '@/lib/one_liners';
import { fetchWeeklyInsight, type WeeklyInsightResult, isEdgeError } from '@/lib/edge';
import { supabaseConfigured } from '@/lib/supabase';

type InsightState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; sentence: string; cached: boolean; empty?: boolean }
  | { kind: 'error'; message: string; retryable: boolean };

function greeting(hour: number, firstName: string): string {
  const trimmed = firstName.trim();
  const who = trimmed && trimmed.length > 0 ? trimmed : 'friend';
  if (hour < 5) return `Late night, ${who}.`;
  if (hour < 12) return `Good morning, ${who}.`;
  if (hour < 17) return `Good afternoon, ${who}.`;
  if (hour < 21) return `Good evening, ${who}.`;
  return `Late night, ${who}.`;
}

export interface HeroCardProps {
  name: string | null | undefined;
  userId: string | null;
  sandbox: boolean;
  showCountdown: boolean;
  daysLeft: number;
  /** Optional trailing action (e.g., "New session" button). */
  action?: ReactNode;
}

export default function HeroCard({
  name,
  userId,
  sandbox,
  showCountdown,
  daysLeft,
  action
}: HeroCardProps) {
  const today = todayISO();
  const now = new Date();
  const firstName = (name ?? '').split(/\s+/)[0] ?? '';
  const heading = greeting(now.getHours(), firstName);
  const line = useMemo(() => pickOneLinerFor(today, userId ?? ''), [today, userId]);

  const [insight, setInsight] = useState<InsightState>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    async function load(force = false) {
      if (!supabaseConfigured || !userId || sandbox) {
        setInsight({ kind: 'idle' });
        return;
      }
      setInsight({ kind: 'loading' });
      const res = await fetchWeeklyInsight({ force });
      if (cancelled) return;
      if (isEdgeError(res)) {
        setInsight({
          kind: 'error',
          message: res.error,
          retryable: res.status !== 429
        });
        return;
      }
      const r = res as WeeklyInsightResult;
      setInsight({
        kind: 'ready',
        sentence: r.sentence,
        cached: r.cached,
        empty: r.empty
      });
    }
    void load(false);
    return () => {
      cancelled = true;
    };
  }, [userId, sandbox, today]);

  async function regenerate() {
    if (!supabaseConfigured || !userId || sandbox) return;
    setInsight({ kind: 'loading' });
    const res = await fetchWeeklyInsight({ force: true });
    if (isEdgeError(res)) {
      setInsight({
        kind: 'error',
        message: res.error,
        retryable: res.status !== 429
      });
      return;
    }
    const r = res as WeeklyInsightResult;
    setInsight({ kind: 'ready', sentence: r.sentence, cached: r.cached, empty: r.empty });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="u-panel relative overflow-hidden"
    >
      <div className="u-margin-line px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-text sm:text-[30px]">
              {heading}
            </h1>
            <p className="mt-1 text-[12.5px] text-text-muted">
              {formatDate(today, 'EEEE, dd MMM')}
              {showCountdown && (
                <>
                  {' · '}
                  <span className="u-num">T−{daysLeft}d</span> to GATE
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            <span className="u-stamp hidden md:inline">rank notebook</span>
          </div>
        </div>

        <div className="u-rule my-4" />

        <div className="flex items-start gap-3">
          <span
            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
            aria-hidden
          />
          <p className="font-display text-[15px] leading-relaxed text-text sm:text-[16px]">
            <span className="u-highlight">{line.text}</span>
          </p>
        </div>

        <div className="u-rule my-4" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="u-label flex items-center gap-1.5 text-text-muted">
            <Sparkles size={12} strokeWidth={1.75} className="text-accent" />
            this week's read
          </p>
          <div className="flex items-center gap-2">
            {insight.kind === 'ready' && (
              <span className="text-[11px] text-text-faint">
                {insight.cached ? 'cached today' : 'fresh'}
              </span>
            )}
            {(insight.kind === 'ready' || insight.kind === 'error') && (
              <button
                type="button"
                onClick={() => void regenerate()}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-text-muted hover:bg-bg-overlay hover:text-text"
                title="Regenerate (uses 1 credit)"
              >
                <RefreshCcw size={11} strokeWidth={1.75} /> regenerate
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 min-h-[52px]">
          <InsightBody state={insight} sandbox={sandbox} />
        </div>
      </div>
    </motion.div>
  );
}

function InsightBody({ state, sandbox }: { state: InsightState; sandbox: boolean }) {
  if (sandbox) {
    return (
      <p className="text-[13px] leading-relaxed text-text-faint">
        Weekly reads run against Supabase. Sign in with a real account to see this week's summary.
      </p>
    );
  }
  if (state.kind === 'idle' || state.kind === 'loading') {
    return (
      <p className="animate-pulse text-[13px] leading-relaxed text-text-faint">
        Reading your last seven days…
      </p>
    );
  }
  if (state.kind === 'error') {
    return (
      <p className="text-[13px] leading-relaxed text-warn">
        Could not fetch this week's read: {state.message}
        {state.retryable && ' — try regenerate.'}
      </p>
    );
  }
  return (
    <motion.p
      key={state.sentence}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="text-[14.5px] leading-relaxed text-text"
    >
      {state.sentence}
    </motion.p>
  );
}
