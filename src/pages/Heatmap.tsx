// F5.2 — Weakness heatmap. Subject × subtopic × root_cause; cell color scales
// with count of not-clean questions in the window. Click any cell to open the
// journal pre-filtered on that intersection.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { RootCause } from '@/types';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Empty } from '@/components/ui/Empty';
import { db } from '@/lib/db';
import { useAuth } from '@/hooks/useAuth';
import { addDaysISO, cn, plural, todayISO } from '@/lib/utils';
import { subjectInk } from '@/lib/subjectInk';
import { ROOT_CAUSES } from '@/lib/constants';
import { heatmapCells, heatmapRowTotals } from '@/lib/analysis';

type CauseKey = RootCause | 'unspecified';

const CAUSE_COLUMNS: { key: CauseKey; label: string }[] = [
  ...ROOT_CAUSES.map((rc) => ({ key: rc.value as CauseKey, label: rc.label })),
  { key: 'unspecified', label: 'Unspecified' }
];

/** Perceptually-graded warm scale so louder cells shout. Zero cells stay muted. */
function cellColor(intensity: number): { bg: string; text: string } {
  // intensity ∈ [0, 1]
  if (intensity === 0) return { bg: 'bg-bg-overlay/30', text: 'text-text-faint' };
  if (intensity < 0.15) return { bg: 'bg-warn/15', text: 'text-warn' };
  if (intensity < 0.35) return { bg: 'bg-warn/35', text: 'text-warn' };
  if (intensity < 0.6) return { bg: 'bg-danger/30', text: 'text-danger' };
  if (intensity < 0.85) return { bg: 'bg-danger/55', text: 'text-white' };
  return { bg: 'bg-danger/80', text: 'text-white' };
}

export default function Heatmap() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const today = todayISO();
  const defaultFrom = addDaysISO(today, -30);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);
  const [groupBySubtopic, setGroupBySubtopic] = useState(true);

  const questions = useLiveQuery(
    async () => (userId ? db.questions.where('user_id').equals(userId).toArray() : []),
    [userId],
    []
  );

  const cells = useMemo(
    () => heatmapCells(questions, { from, to, groupBySubtopic }),
    [questions, from, to, groupBySubtopic]
  );

  // Row keys in original order of appearance (already sorted by cell count desc).
  const rowKeys: { subject: string; subtopic: string | null }[] = useMemo(() => {
    const seen = new Set<string>();
    const rows: { subject: string; subtopic: string | null }[] = [];
    for (const c of cells) {
      const key = `${c.subject}||${c.subtopic ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ subject: c.subject, subtopic: c.subtopic });
    }
    return rows;
  }, [cells]);

  const cellByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cells) {
      m.set(`${c.subject}||${c.subtopic ?? ''}||${c.rootCause}`, c.count);
    }
    return m;
  }, [cells]);

  const rowTotals = useMemo(() => heatmapRowTotals(cells), [cells]);
  const rowMax = useMemo(() => {
    let max = 0;
    for (const c of cells) if (c.count > max) max = c.count;
    return Math.max(1, max);
  }, [cells]);

  const rowsShown = rowKeys.slice(0, 40);
  const rowTotalMax = Math.max(1, ...rowTotals.values());

  function openJournalForCell(
    subject: string,
    subtopic: string | null,
    cause: CauseKey
  ) {
    const params = new URLSearchParams();
    params.set('subject', subject);
    if (subtopic) params.set('subtopic', subtopic);
    if (cause !== 'unspecified') params.set('cause', cause);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    navigate(`/journal?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Weakness heatmap"
        description="Where mistakes concentrate. Loud cells are targets. Click a cell to open the journal there."
      />

      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="u-label">From</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} mono className="w-[160px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="u-label">To</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} mono className="w-[160px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="u-label">Granularity</span>
            <div className="inline-flex divide-x divide-border overflow-hidden rounded border border-border bg-bg-raised shadow-sm">
              <button
                type="button"
                onClick={() => setGroupBySubtopic(false)}
                className={cn(
                  'h-9 px-3 text-[12px] transition-colors active:scale-95',
                  !groupBySubtopic
                    ? 'bg-accent-faint font-semibold text-accent'
                    : 'text-text-muted hover:bg-bg-overlay hover:text-text'
                )}
              >
                Subject
              </button>
              <button
                type="button"
                onClick={() => setGroupBySubtopic(true)}
                className={cn(
                  'h-9 px-3 text-[12px] transition-colors active:scale-95',
                  groupBySubtopic
                    ? 'bg-accent-faint font-semibold text-accent'
                    : 'text-text-muted hover:bg-bg-overlay hover:text-text'
                )}
              >
                Subject × subtopic
              </button>
            </div>
          </div>
          <div className="ml-auto flex flex-col gap-0.5 text-[12px] text-text-faint">
            <span className="u-label">Window</span>
            <span className="u-num">
              {cells.reduce((n, c) => n + c.count, 0)} mistakes across{' '}
              {rowKeys.length} {plural(rowKeys.length, 'row')}
            </span>
          </div>
        </CardBody>
      </Card>

      {rowsShown.length === 0 ? (
        <Card>
          <Empty
            title="No mistakes in this window"
            hint="Widen the date range or tag more questions."
            className="border-0 py-10"
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[12px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-bg-raised px-3 py-2 text-left font-semibold text-text-muted">
                    Subject{groupBySubtopic ? ' · Subtopic' : ''}
                  </th>
                  {CAUSE_COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className="px-2 py-2 text-center font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted"
                    >
                      {c.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-semibold text-text-muted">Row Σ</th>
                </tr>
              </thead>
              <tbody>
                {rowsShown.map((r, i) => {
                  const ink = subjectInk(r.subject);
                  const rowKey = `${r.subject}||${r.subtopic ?? ''}`;
                  const rowTotal = rowTotals.get(rowKey) ?? 0;
                  return (
                    <tr key={rowKey} className={cn(i % 2 === 1 && 'bg-bg-overlay/25')}>
                      <td className="sticky left-0 z-10 whitespace-nowrap border-r border-border bg-inherit px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', ink.dot)} />
                          <span className="font-medium text-text">{r.subject}</span>
                          {r.subtopic && (
                            <span className="text-text-muted">· {r.subtopic}</span>
                          )}
                        </span>
                      </td>
                      {CAUSE_COLUMNS.map((c) => {
                        const count = cellByKey.get(`${rowKey}||${c.key}`) ?? 0;
                        const intensity = count === 0 ? 0 : count / rowMax;
                        const { bg, text } = cellColor(intensity);
                        const label = `${count} ${plural(count, 'mistake')} in ${r.subject}${r.subtopic ? ` · ${r.subtopic}` : ''} · ${c.label}`;
                        const disabled = count === 0;
                        return (
                          <td key={c.key} className="p-1 text-center">
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => openJournalForCell(r.subject, r.subtopic, c.key)}
                              aria-label={label}
                              title={label}
                              className={cn(
                                'h-9 w-full rounded font-mono text-[12px] transition-transform',
                                bg,
                                text,
                                !disabled &&
                                  'hover:-translate-y-px hover:shadow-card active:translate-y-0',
                                disabled && 'cursor-default'
                              )}
                            >
                              {count === 0 ? '·' : count}
                            </button>
                          </td>
                        );
                      })}
                      <td className="border-l border-border px-3 py-2 text-right">
                        <span
                          className={cn(
                            'u-num inline-block rounded px-2 py-0.5',
                            rowTotal / rowTotalMax > 0.6
                              ? 'bg-danger/20 text-danger'
                              : rowTotal / rowTotalMax > 0.3
                                ? 'bg-warn/25 text-warn'
                                : 'text-text-muted'
                          )}
                        >
                          {rowTotal}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rowKeys.length > rowsShown.length && (
            <div className="border-t border-border px-4 py-2 text-[12px] text-text-faint">
              Showing top 40 by count — narrow the window or granularity to see less.
            </div>
          )}
        </Card>
      )}

      <Card>
        <CardBody className="flex flex-wrap items-center gap-4 text-[12px] text-text-muted">
          <span className="u-label">legend</span>
          {[0, 0.15, 0.35, 0.6, 0.85].map((step) => {
            const { bg } = cellColor(step);
            return (
              <span key={step} className="flex items-center gap-1.5">
                <span className={cn('inline-block h-3 w-6 rounded', bg)} />
                <span className="text-text-faint">
                  {step === 0 ? 'none' : step === 0.85 ? 'loudest' : `${Math.round(step * 100)}%`}
                </span>
              </span>
            );
          })}
          <span className="ml-auto text-[12px] text-text-faint">
            Only outcomes ≠ R count. Row total = mistakes per (subject{groupBySubtopic ? ' × subtopic' : ''}) in window.
          </span>
        </CardBody>
      </Card>
    </div>
  );
}
