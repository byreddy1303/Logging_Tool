// Full day plan modal — five sections rendered as collapsible cards.
//   1. Study sessions   (list of subject × mode × priority × duration × goal)
//   2. Day structure    (wake, sleep, hours, breaks, day type)
//   3. Mindset & energy (energy forecast, mood, one-thing note)
//   4. Non-study tasks  (exercise + errands + social)
//   5. Review           (fill after the day)
//
// Persistence: writes on every field change to localStorage via
// planner-storage; the modal itself carries no async state.
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronDown,
  Plus,
  Send,
  Trash2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { cn, formatDate, uuid } from '@/lib/utils';
import {
  BREAK_PATTERNS,
  DAY_TYPES,
  DURATIONS,
  END_MOODS,
  ENERGY_FORECASTS,
  MOOD_INTENTS,
  PLANNER_SUBJECTS,
  PRIORITIES,
  STUDY_MODES
} from '@/lib/planner-constants';
import type {
  DayPlan,
  DayType,
  EnergyForecast,
  Priority,
  Replicate,
  StudyMode,
  StudySession
} from '@/lib/planner-storage';

interface Props {
  date: string;
  plan: DayPlan;
  onChange: (next: DayPlan) => void;
  onClose: () => void;
  onDelete: () => void;
  onSendWhatsApp?: () => void;
  canSendWhatsApp: boolean;
}

export default function DayPlanModal({
  date,
  plan,
  onChange,
  onClose,
  onDelete,
  onSendWhatsApp,
  canSendWhatsApp
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function update<K extends keyof DayPlan>(key: K, value: DayPlan[K]) {
    onChange({ ...plan, [key]: value });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-text/30 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ y: 16, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="my-4 w-full max-w-[860px] overflow-hidden rounded-lg border border-border bg-bg-raised shadow-lift"
      >
        <header className="flex flex-wrap items-center gap-3 border-b border-border bg-bg-overlay/30 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="u-label">Day plan</p>
            <h2 className="font-display text-[18px] font-bold text-text">
              {formatDate(date, 'EEEE, dd MMM yyyy')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onSendWhatsApp && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onSendWhatsApp}
                disabled={!canSendWhatsApp}
                title={
                  canSendWhatsApp
                    ? "Send today's plan to WhatsApp"
                    : 'Configure WhatsApp in Settings first'
                }
              >
                <Send size={11} strokeWidth={2} className="mr-1" />
                Send to WA
              </Button>
            )}
            {!confirmDelete ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                title="Clear this day's plan"
              >
                <Trash2 size={11} strokeWidth={1.75} className="mr-1" />
                Clear
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    onDelete();
                    setConfirmDelete(false);
                  }}
                >
                  Confirm clear
                </Button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-text-faint transition-colors hover:bg-bg-overlay hover:text-text"
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-3 p-4 sm:p-5">
          <Section title="1 · Study sessions" defaultOpen>
            <SessionsEditor
              sessions={plan.sessions}
              onChange={(sessions) => update('sessions', sessions)}
            />
          </Section>

          <Section title="2 · Day structure">
            <StructureEditor
              structure={plan.structure}
              onChange={(structure) => update('structure', structure)}
            />
          </Section>

          <Section title="3 · Mindset & energy check">
            <MindsetEditor
              mindset={plan.mindset}
              onChange={(mindset) => update('mindset', mindset)}
            />
          </Section>

          <Section title="4 · Non-study tasks (optional)">
            <NonStudyEditor
              nonStudy={plan.nonStudy}
              onChange={(nonStudy) => update('nonStudy', nonStudy)}
            />
          </Section>

          <Section title="5 · Review (fill after the day)">
            <ReviewEditor
              review={plan.review}
              onChange={(review) => update('review', review)}
            />
          </Section>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------ section shell ---------------------------- */

function Section({
  title,
  defaultOpen = false,
  children
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded border border-border bg-bg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-bg-overlay/50"
      >
        <span className="font-display text-[13.5px] font-semibold text-text">
          {title}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          className={cn(
            'text-text-faint transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && <div className="border-t border-border/70 p-3">{children}</div>}
    </section>
  );
}

/* ---------------------------- sessions editor ---------------------------- */

function SessionsEditor({
  sessions,
  onChange
}: {
  sessions: StudySession[];
  onChange: (next: StudySession[]) => void;
}) {
  function addSession() {
    const next: StudySession = {
      id: uuid(),
      subject: PLANNER_SUBJECTS[0],
      durationMin: 60,
      mode: 'Deep Study',
      priority: 'P2 High',
      target: ''
    };
    onChange([...sessions, next]);
  }
  function update(id: string, patch: Partial<StudySession>) {
    onChange(sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function remove(id: string) {
    onChange(sessions.filter((s) => s.id !== id));
  }

  const total = sessions.reduce((s, x) => s + (x.durationMin || 0), 0);

  return (
    <div className="flex flex-col gap-3">
      {sessions.length === 0 ? (
        <p className="text-[12px] text-text-muted">
          No sessions yet. Add one to start planning the day.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((s, i) => (
            <SessionRow
              key={s.id}
              index={i}
              session={s}
              onUpdate={(patch) => update(s.id, patch)}
              onRemove={() => remove(s.id)}
            />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={addSession}>
          <Plus size={11} strokeWidth={2} className="mr-1" />
          Add subject
        </Button>
        <span className="u-num text-[11.5px] text-text-muted">
          {sessions.length} session{sessions.length === 1 ? '' : 's'} · planned {formatHours(total)}
        </span>
      </div>
    </div>
  );
}

function SessionRow({
  index,
  session,
  onUpdate,
  onRemove
}: {
  index: number;
  session: StudySession;
  onUpdate: (patch: Partial<StudySession>) => void;
  onRemove: () => void;
}) {
  const isCustomSubject = session.subject === 'Custom...';
  const durationIsCustom = !DURATIONS.slice(0, -1).some(
    (d) => d.value === session.durationMin
  );

  return (
    <div className="rounded border border-border/70 bg-bg-raised px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <p className="u-label">Session {index + 1}</p>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-text-faint transition-colors hover:bg-danger-faint hover:text-danger"
          aria-label="Remove session"
        >
          <Trash2 size={12} strokeWidth={1.75} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Subject">
          <Select
            value={session.subject}
            onChange={(e) => onUpdate({ subject: e.target.value })}
          >
            {PLANNER_SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          {isCustomSubject && (
            <Input
              className="mt-1.5"
              placeholder="Custom subject name"
              value={session.customSubject ?? ''}
              onChange={(e) => onUpdate({ customSubject: e.target.value })}
              maxLength={60}
            />
          )}
        </Field>
        <Field label="Duration">
          <Select
            value={durationIsCustom ? '-1' : String(session.durationMin)}
            onChange={(e) => {
              const v = Number(e.target.value);
              onUpdate({ durationMin: v === -1 ? 60 : v });
            }}
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
          {durationIsCustom && (
            <Input
              className="mt-1.5"
              type="number"
              min={1}
              max={720}
              value={session.durationMin}
              onChange={(e) =>
                onUpdate({
                  durationMin: Math.max(
                    1,
                    Math.min(720, Math.round(Number(e.target.value) || 0))
                  )
                })
              }
              placeholder="Minutes"
            />
          )}
        </Field>
        <Field label="Study mode">
          <Select
            value={session.mode}
            onChange={(e) => onUpdate({ mode: e.target.value as StudyMode })}
          >
            {STUDY_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select
            value={session.priority}
            onChange={(e) => onUpdate({ priority: e.target.value as Priority })}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Target / goal" className="sm:col-span-2">
          <Textarea
            rows={2}
            value={session.target}
            onChange={(e) => onUpdate({ target: e.target.value })}
            placeholder="e.g., Complete sets & relations, solve 20 PYQs"
            maxLength={280}
          />
        </Field>
        <Field label="Resource / topic (optional)" className="sm:col-span-2">
          <Input
            value={session.resource ?? ''}
            onChange={(e) => onUpdate({ resource: e.target.value })}
            placeholder="Rosen ch. 6, NPTEL lec 12, PYQ set…"
            maxLength={160}
          />
        </Field>
      </div>
    </div>
  );
}

/* --------------------------- structure editor ---------------------------- */

function StructureEditor({
  structure,
  onChange
}: {
  structure: DayPlan['structure'];
  onChange: (next: DayPlan['structure']) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Wake up">
        <Input
          type="time"
          value={structure.wakeAt}
          onChange={(e) => onChange({ ...structure, wakeAt: e.target.value })}
        />
      </Field>
      <Field label="Sleep target">
        <Input
          type="time"
          value={structure.sleepAt}
          onChange={(e) => onChange({ ...structure, sleepAt: e.target.value })}
        />
      </Field>
      <Field label="Total study hours target">
        <Input
          type="number"
          min={0}
          max={16}
          step={0.5}
          value={structure.totalHoursTarget}
          onChange={(e) =>
            onChange({
              ...structure,
              totalHoursTarget: Math.max(
                0,
                Math.min(16, Number(e.target.value) || 0)
              )
            })
          }
        />
      </Field>
      <Field label="Day type">
        <Select
          value={structure.dayType}
          onChange={(e) =>
            onChange({ ...structure, dayType: e.target.value as DayType })
          }
        >
          {DAY_TYPES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Breaks" className="sm:col-span-2">
        <Select
          value={structure.breakPattern}
          onChange={(e) =>
            onChange({
              ...structure,
              breakPattern: e.target.value as DayPlan['structure']['breakPattern']
            })
          }
        >
          {BREAK_PATTERNS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </Select>
        {structure.breakPattern === 'custom' && (
          <Input
            className="mt-1.5"
            placeholder="Describe your custom cadence (e.g., 40/8)"
            value={structure.customBreak ?? ''}
            onChange={(e) =>
              onChange({ ...structure, customBreak: e.target.value })
            }
            maxLength={80}
          />
        )}
      </Field>
    </div>
  );
}

/* ---------------------------- mindset editor ----------------------------- */

function MindsetEditor({
  mindset,
  onChange
}: {
  mindset: DayPlan['mindset'];
  onChange: (next: DayPlan['mindset']) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Energy forecast">
        <Select
          value={mindset.energyForecast}
          onChange={(e) =>
            onChange({
              ...mindset,
              energyForecast: e.target.value as EnergyForecast
            })
          }
        >
          {ENERGY_FORECASTS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Mood intent">
        <Select
          value={mindset.moodIntent}
          onChange={(e) => onChange({ ...mindset, moodIntent: e.target.value })}
        >
          {MOOD_INTENTS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="The one thing I MUST accomplish today" className="sm:col-span-2">
        <Textarea
          rows={2}
          value={mindset.motivationNote}
          onChange={(e) =>
            onChange({ ...mindset, motivationNote: e.target.value })
          }
          placeholder="Non-negotiable outcome for the day."
          maxLength={280}
        />
      </Field>
    </div>
  );
}

/* --------------------------- non-study editor ---------------------------- */

function NonStudyEditor({
  nonStudy,
  onChange
}: {
  nonStudy: DayPlan['nonStudy'];
  onChange: (next: DayPlan['nonStudy']) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Exercise / Yoga / Sadhana">
        <label className="flex items-center gap-2 rounded border border-border bg-bg-raised px-3 py-2 text-[12.5px] text-text-muted">
          <input
            type="checkbox"
            checked={nonStudy.exerciseDone}
            onChange={(e) =>
              onChange({ ...nonStudy, exerciseDone: e.target.checked })
            }
            className="h-4 w-4 accent-accent"
          />
          <span>Planned / done</span>
        </label>
        <Input
          className="mt-1.5"
          type="time"
          value={nonStudy.exerciseTime}
          onChange={(e) =>
            onChange({ ...nonStudy, exerciseTime: e.target.value })
          }
        />
      </Field>
      <Field label="Personal errands / appointments">
        <Textarea
          rows={2}
          value={nonStudy.errands}
          onChange={(e) => onChange({ ...nonStudy, errands: e.target.value })}
          placeholder="Doctor's visit at 5pm, groceries…"
          maxLength={240}
        />
      </Field>
      <Field label="Social commitments" className="sm:col-span-2">
        <Textarea
          rows={2}
          value={nonStudy.social}
          onChange={(e) => onChange({ ...nonStudy, social: e.target.value })}
          placeholder="Cousin's call, family dinner…"
          maxLength={240}
        />
      </Field>
    </div>
  );
}

/* ----------------------------- review editor ----------------------------- */

function ReviewEditor({
  review,
  onChange
}: {
  review: DayPlan['review'];
  onChange: (next: DayPlan['review']) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field label={`Completion — ${review.completionPct}%`}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={review.completionPct}
          onChange={(e) =>
            onChange({ ...review, completionPct: Number(e.target.value) })
          }
          className="w-full accent-accent"
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="What went well">
          <Textarea
            rows={3}
            value={review.wentWell}
            onChange={(e) => onChange({ ...review, wentWell: e.target.value })}
            maxLength={500}
          />
        </Field>
        <Field label="What was missed & why">
          <Textarea
            rows={3}
            value={review.missed}
            onChange={(e) => onChange({ ...review, missed: e.target.value })}
            maxLength={500}
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Mood at end of day">
          <div className="flex flex-wrap gap-1.5">
            {END_MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() =>
                  onChange({
                    ...review,
                    endMood: review.endMood === m.value ? '' : m.value
                  })
                }
                className={cn(
                  'inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                  review.endMood === m.value
                    ? 'border-accent bg-accent-faint text-accent'
                    : 'border-border bg-bg-raised text-text-muted hover:border-border-hover'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Replicate this plan?">
          <div className="inline-flex divide-x divide-border overflow-hidden rounded border border-border">
            {(['yes', 'partial', 'no'] as Replicate[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() =>
                  onChange({
                    ...review,
                    replicate: review.replicate === r ? '' : r
                  })
                }
                className={cn(
                  'flex-1 px-3 py-1.5 text-[12.5px] capitalize transition-colors',
                  review.replicate === r
                    ? 'bg-accent-faint font-semibold text-accent'
                    : 'text-text-muted hover:bg-bg-overlay'
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}

/* ------------------------------ primitives ------------------------------- */

function Field({
  label,
  className,
  children
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="u-label">{label}</span>
      {children}
    </div>
  );
}

function formatHours(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

/** Keep unused imports referenced so tsc --noEmit doesn't drop them if we
 *  refactor later. */
void useMemo;
