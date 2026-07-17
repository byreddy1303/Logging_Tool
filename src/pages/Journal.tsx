// Journal (F3.1): every tagged question, filterable six ways, fuzzy trigger
// search, expandable rows, 50/page.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import type { QuestionRow } from '@/types';
import { db } from '@/lib/db';
import {
  OUTCOMES,
  OUTCOME_BY_CODE,
  ROOT_CAUSES,
  MARK_DECISIONS,
  SUBJECTS,
  SOURCE_KINDS,
  SOURCE_KIND_BY_VALUE,
  QUESTION_FORMATS,
  type SourceKind,
  type QuestionFormat
} from '@/lib/constants';
import { cn, formatDate, levenshtein, secondsToClock, plural } from '@/lib/utils';
import { subjectInk } from '@/lib/subjectInk';
import { useAuth } from '@/hooks/useAuth';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Empty } from '@/components/ui/Empty';
import { ImagePreview } from '@/components/shared/ImagePreview';

const PAGE_SIZE = 50;

const TONE_BADGE: Record<'ok' | 'slow' | 'guess' | 'wrong', 'success' | 'warn' | 'guess' | 'danger'> = {
  ok: 'success',
  slow: 'warn',
  guess: 'guess',
  wrong: 'danger'
};

/** Substring, or every query word within edit distance 2 of some target word. */
function fuzzy(query: string, target: string): boolean {
  const q = query.trim().toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return true;
  const words = t.split(/\s+/);
  return q
    .split(/\s+/)
    .every((qw) => words.some((w) => w.includes(qw) || levenshtein(qw, w) <= 2));
}

interface Filters {
  trigger: string;
  pattern: string;
  subject: string;
  outcome: string;
  cause: string;
  mark: string;
  source: string;
  format: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = {
  trigger: '',
  pattern: '',
  subject: '',
  outcome: '',
  cause: '',
  mark: '',
  source: '',
  format: '',
  from: '',
  to: ''
};

/** Extract the source-kind key from a canonical source_ref (prefix match). */
function detectSourceKind(ref: string | null): SourceKind | null {
  if (!ref) return null;
  for (const s of SOURCE_KINDS) {
    if (ref === s.refPrefix || ref.startsWith(`${s.refPrefix} · `)) return s.value;
  }
  return null;
}

/** Extract question format if it was appended as the last segment of source_ref. */
function detectFormat(ref: string | null): QuestionFormat | null {
  if (!ref) return null;
  for (const qf of QUESTION_FORMATS) {
    if (ref === qf.value || ref.endsWith(` · ${qf.value}`)) return qf.value;
  }
  return null;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="u-label">{label}</p>
      <p className="mt-1 text-[13px] leading-relaxed">{children}</p>
    </div>
  );
}

function Row({ q, onImage }: { q: QuestionRow; onImage: (src: string, caption: string) => void }) {
  const [open, setOpen] = useState(false);
  const spec = OUTCOME_BY_CODE[q.outcome];
  const ink = subjectInk(q.subject);
  const over = q.time_spent_sec > q.target_time_sec;
  const sourceKind = detectSourceKind(q.source_ref);
  const sourceLabel = sourceKind ? SOURCE_KIND_BY_VALUE[sourceKind].label : null;
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-bg-overlay/50"
      >
        <span className="u-num w-[74px] shrink-0 text-[11px] text-text-faint">
          {formatDate(q.created_at.slice(0, 10), 'dd MMM yy')}
        </span>
        <span className="flex w-[130px] shrink-0 items-center gap-1.5 md:w-[170px]">
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', ink.dot)} />
          <span className="truncate text-[12px] text-text-muted">{q.subject}</span>
        </span>
        <Badge tone={TONE_BADGE[spec.tone]} className="shrink-0">
          {q.outcome}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-[13px]">
          {q.pattern_name ?? <span className="text-text-faint">no pattern</span>}
        </span>
        <span className={cn('u-num shrink-0 text-[12px]', over ? 'text-warn' : 'text-text-faint')}>
          {secondsToClock(q.time_spent_sec)}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          className={cn('shrink-0 text-text-faint transition-transform', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-4 border-t border-border bg-bg-overlay/40 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="trigger">
                {q.trigger_sentence ? (
                  <span className="u-highlight">{q.trigger_sentence}</span>
                ) : (
                  <span className="text-text-faint">—</span>
                )}
              </Detail>
              <Detail label="root cause">
                {q.root_cause ? (
                  ROOT_CAUSES.find((rc) => rc.value === q.root_cause)?.label
                ) : (
                  <span className="text-text-faint">—</span>
                )}
              </Detail>
              <Detail label="time vs target">
                <span className="u-num">{secondsToClock(q.time_spent_sec)}</span>
                <span className="text-text-faint"> of </span>
                <span className="u-num">{secondsToClock(q.target_time_sec)}</span>
                {over && <span className="ml-1 text-warn">over</span>}
              </Detail>
              <Detail label="source">
                {q.source_ref || q.image_url ? (
                  <div className="flex flex-col gap-1.5">
                    {q.source_ref && <span>{q.source_ref}</span>}
                    {q.image_url && (
                      <button
                        type="button"
                        onClick={() =>
                          onImage(q.image_url as string, q.source_ref ?? sourceLabel ?? 'Question')
                        }
                        className="group relative h-16 w-16 overflow-hidden rounded border border-border shadow-sm transition-transform hover:-translate-y-px hover:shadow-card active:translate-y-0"
                        aria-label="View full-size image"
                      >
                        <img
                          src={q.image_url}
                          alt="question scan thumbnail"
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-text-faint">—</span>
                )}
              </Detail>
              {q.mark_decision && (
                <Detail label="mark decision">
                  {MARK_DECISIONS.find((m) => m.value === q.mark_decision)?.label}
                  {q.mark_correct !== null && (
                    <span className={cn('ml-1.5', q.mark_correct ? 'text-success' : 'text-danger')}>
                      {q.mark_correct ? 'paid off' : 'did not'}
                    </span>
                  )}
                </Detail>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Journal() {
  const { userId } = useAuth();
  const [params] = useSearchParams();
  const [f, setF] = useState<Filters>(() => ({
    ...EMPTY_FILTERS,
    pattern: params.get('pattern') ?? ''
  }));
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<{ src: string; caption: string } | null>(null);

  const questions = useLiveQuery(async () => {
    if (!userId) return [];
    const rows = await db.questions.where('user_id').equals(userId).sortBy('created_at');
    return rows.reverse();
  }, [userId]);

  const filtered = useMemo(() => {
    let rows = questions ?? [];
    if (f.subject) rows = rows.filter((q) => q.subject === f.subject);
    if (f.outcome) rows = rows.filter((q) => q.outcome === f.outcome);
    if (f.cause) rows = rows.filter((q) => q.root_cause === f.cause);
    if (f.mark) rows = rows.filter((q) => q.mark_decision === f.mark);
    if (f.source) rows = rows.filter((q) => detectSourceKind(q.source_ref) === f.source);
    if (f.format) rows = rows.filter((q) => detectFormat(q.source_ref) === f.format);
    if (f.from) rows = rows.filter((q) => q.created_at.slice(0, 10) >= f.from);
    if (f.to) rows = rows.filter((q) => q.created_at.slice(0, 10) <= f.to);
    if (f.pattern.trim())
      rows = rows.filter((q) => q.pattern_name && fuzzy(f.pattern, q.pattern_name));
    if (f.trigger.trim())
      rows = rows.filter((q) => q.trigger_sentence && fuzzy(f.trigger, q.trigger_sentence));
    return rows;
  }, [questions, f]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const pageRows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const filtersActive = Object.values(f).some((v) => v !== '');

  function set<K extends keyof Filters>(key: K, value: string) {
    setF((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Journal"
        description={
          questions === undefined
            ? 'Loading…'
            : `${filtered.length} of ${questions.length} ${plural(questions.length, 'entry', 'entries')}`
        }
      />

      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Input
              value={f.trigger}
              onChange={(e) => set('trigger', e.target.value)}
              placeholder="Search trigger phrases (fuzzy)…"
              aria-label="Search trigger phrases"
              className="min-w-[220px] flex-1"
            />
            <Input
              value={f.pattern}
              onChange={(e) => set('pattern', e.target.value)}
              placeholder="Pattern name…"
              aria-label="Filter by pattern"
              className="min-w-[160px] flex-1 sm:max-w-[220px]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={f.subject}
              onChange={(e) => set('subject', e.target.value)}
              aria-label="Filter by subject"
              className="w-[180px]"
            >
              <option value="">All subjects</option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select
              value={f.outcome}
              onChange={(e) => set('outcome', e.target.value)}
              aria-label="Filter by outcome"
              className="w-[130px]"
            >
              <option value="">All outcomes</option>
              {OUTCOMES.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.code}
                </option>
              ))}
            </Select>
            <Select
              value={f.cause}
              onChange={(e) => set('cause', e.target.value)}
              aria-label="Filter by root cause"
              className="w-[140px]"
            >
              <option value="">All causes</option>
              {ROOT_CAUSES.map((rc) => (
                <option key={rc.value} value={rc.value}>
                  {rc.label}
                </option>
              ))}
            </Select>
            <Select
              value={f.mark}
              onChange={(e) => set('mark', e.target.value)}
              aria-label="Filter by mark decision"
              className="w-[130px]"
            >
              <option value="">All marks</option>
              {MARK_DECISIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
            <Select
              value={f.source}
              onChange={(e) => set('source', e.target.value)}
              aria-label="Filter by source"
              className="w-[170px]"
            >
              <option value="">All sources</option>
              {SOURCE_KINDS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Select
              value={f.format}
              onChange={(e) => set('format', e.target.value)}
              aria-label="Filter by question format"
              className="w-[130px]"
            >
              <option value="">All formats</option>
              {QUESTION_FORMATS.map((qf) => (
                <option key={qf.value} value={qf.value}>
                  {qf.label}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              value={f.from}
              onChange={(e) => set('from', e.target.value)}
              aria-label="From date"
              className="w-[150px]"
              mono
            />
            <span className="text-[12px] text-text-faint">to</span>
            <Input
              type="date"
              value={f.to}
              onChange={(e) => set('to', e.target.value)}
              aria-label="To date"
              className="w-[150px]"
              mono
            />
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setF(EMPTY_FILTERS);
                  setPage(0);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        {pageRows.length > 0 ? (
          <>
            <div>
              {pageRows.map((q) => (
                <Row
                  key={q.id}
                  q={q}
                  onImage={(src, caption) => setPreview({ src, caption })}
                />
              ))}
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                >
                  Prev
                </Button>
                <span className="u-num text-[12px] text-text-muted">
                  page {current + 1} of {pages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={current >= pages - 1}
                  onClick={() => setPage(current + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <Empty
            title={filtersActive ? 'No entries match' : 'Nothing logged yet'}
            hint={
              filtersActive
                ? 'Loosen a filter or clear them all.'
                : 'Tag questions during a session and they land here.'
            }
            className="border-0 py-10"
          />
        )}
      </Card>

      <ImagePreview
        src={preview?.src ?? null}
        caption={preview?.caption}
        open={!!preview}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
