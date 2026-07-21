// Pattern library (F3.2): counts are aggregated live from questions so the
// number always matches the journal; the patterns table supplies metadata.
// Merge suggestions (edit distance ≤ 3) are advisory — the user confirms.
//
// UX (2026-07-19): grouped by subject. Landing view lists subjects with
// count badges; clicking a subject drills down to that subject's patterns.
// A "Back to subjects" button returns to the overview.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ArrowRight, GitMerge } from 'lucide-react';
import type { PatternRow } from '@/types';
import { db } from '@/lib/db';
import { writeLocal, deleteLocal } from '@/lib/sync';
import { cn, formatDate, levenshtein, plural } from '@/lib/utils';
import { subjectInk } from '@/lib/subjectInk';
import { useAuth } from '@/hooks/useAuth';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Empty } from '@/components/ui/Empty';

interface Entry {
  row: PatternRow;
  liveCount: number;
}

interface MergePair {
  from: Entry;
  into: Entry;
}

interface SubjectGroup {
  subject: string;
  entries: Entry[];
  totalHits: number;
  reflexed: number;
}

export default function Patterns() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<MergePair | null>(null);
  const [merging, setMerging] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const patterns = useLiveQuery(
    () => (userId ? db.patterns.where('user_id').equals(userId).toArray() : []),
    [userId]
  );
  const questions = useLiveQuery(
    () => (userId ? db.questions.where('user_id').equals(userId).toArray() : []),
    [userId]
  );

  const entries = useMemo<Entry[]>(() => {
    const counts = new Map<string, number>();
    for (const q of questions ?? []) {
      if (q.pattern_name) counts.set(q.pattern_name, (counts.get(q.pattern_name) ?? 0) + 1);
    }
    return (patterns ?? [])
      .map((row) => ({ row, liveCount: counts.get(row.name) ?? 0 }))
      .sort((a, b) => b.liveCount - a.liveCount || a.row.name.localeCompare(b.row.name));
  }, [patterns, questions]);

  const groups = useMemo<SubjectGroup[]>(() => {
    const bySubject = new Map<string, Entry[]>();
    for (const e of entries) {
      const arr = bySubject.get(e.row.subject) ?? [];
      arr.push(e);
      bySubject.set(e.row.subject, arr);
    }
    const list: SubjectGroup[] = [];
    for (const [subject, arr] of bySubject) {
      list.push({
        subject,
        entries: arr,
        totalHits: arr.reduce((s, x) => s + x.liveCount, 0),
        reflexed: arr.filter((x) => x.row.is_reflexed).length
      });
    }
    return list.sort(
      (a, b) => b.totalHits - a.totalHits || a.subject.localeCompare(b.subject)
    );
  }, [entries]);

  // Merge suggestions are scoped to the currently selected subject when we're
  // drilled in, and hidden on the subject overview to keep the landing scannable.
  const scopedEntries = useMemo(() => {
    if (!selectedSubject) return [];
    return entries.filter((e) => e.row.subject === selectedSubject);
  }, [entries, selectedSubject]);

  const suggestions = useMemo(() => {
    if (!selectedSubject) return [];
    const pool = scopedEntries;
    const pairs: MergePair[] = [];
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const a = pool[i];
        const b = pool[j];
        if (levenshtein(a.row.name, b.row.name) <= 3) {
          pairs.push(
            a.liveCount >= b.liveCount ? { from: b, into: a } : { from: a, into: b }
          );
        }
      }
    }
    return pairs.slice(0, 5);
  }, [scopedEntries, selectedSubject]);

  async function merge({ from, into }: MergePair) {
    if (!userId || merging) return;
    setMerging(true);
    try {
      const qs = await db.questions
        .where('[user_id+pattern_name]')
        .equals([userId, from.row.name])
        .toArray();
      for (const q of qs) {
        await writeLocal('questions', { ...q, pattern_name: into.row.name });
      }
      const total = await db.questions
        .where('[user_id+pattern_name]')
        .equals([userId, into.row.name])
        .count();
      await writeLocal('patterns', { ...into.row, count: total });
      await deleteLocal('patterns', from.row.id);
      setConfirm(null);
    } finally {
      setMerging(false);
    }
  }

  const loading = patterns === undefined || questions === undefined;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Patterns"
        description={
          loading
            ? 'Loading…'
            : selectedSubject
              ? `${scopedEntries.length} named ${plural(scopedEntries.length, 'trick', 'tricks')} in ${selectedSubject}`
              : `${entries.length} reusable ${plural(entries.length, 'trick', 'tricks')} across ${groups.length} ${plural(groups.length, 'subject')}`
        }
      />

      {selectedSubject && (
        <div>
          <button
            type="button"
            onClick={() => setSelectedSubject(null)}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-bg-raised px-3 py-1.5 text-[12.5px] text-text-muted transition-colors hover:border-border-hover hover:text-text"
          >
            <ArrowLeft size={12} strokeWidth={1.75} />
            All subjects
          </button>
        </div>
      )}

      {selectedSubject && suggestions.length > 0 && (
        <Card>
          <CardHeader
            title="Possible duplicates in this subject"
            aside={
              <span className="u-label text-text-faint">
                advisory — nothing happens without you
              </span>
            }
          />
          <CardBody className="flex flex-col gap-2">
            {suggestions.map((p) => (
              <div
                key={`${p.from.row.id}-${p.into.row.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-bg-raised px-3 py-2 shadow-sm"
              >
                <p className="flex min-w-0 flex-wrap items-center gap-2 text-[13px]">
                  <span className="truncate font-medium">{p.from.row.name}</span>
                  <span className="u-num text-[11px] text-text-faint">
                    ×{p.from.liveCount}
                  </span>
                  <ArrowRight
                    size={13}
                    strokeWidth={1.75}
                    className="shrink-0 text-text-faint"
                  />
                  <span className="truncate font-medium">{p.into.row.name}</span>
                  <span className="u-num text-[11px] text-text-faint">
                    ×{p.into.liveCount}
                  </span>
                </p>
                <Button size="sm" onClick={() => setConfirm(p)}>
                  <GitMerge size={13} strokeWidth={1.75} />
                  Merge
                </Button>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {!selectedSubject ? (
        <Card>
          {groups.length > 0 ? (
            <div>
              {groups.map((g) => {
                const ink = subjectInk(g.subject);
                return (
                  <button
                    key={g.subject}
                    type="button"
                    onClick={() => setSelectedSubject(g.subject)}
                    className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-bg-overlay/50"
                  >
                    <span className={cn('h-2 w-2 rounded-full', ink.dot)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-text">
                        {g.subject}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-text-muted">
                        <span>
                          {g.entries.length}{' '}
                          {plural(g.entries.length, 'pattern')}
                        </span>
                        <span className="text-text-faint">·</span>
                        <span>
                          {g.totalHits} tagged{' '}
                          {plural(g.totalHits, 'question')}
                        </span>
                        {g.reflexed > 0 && (
                          <>
                            <span className="text-text-faint">·</span>
                            <span>{g.reflexed} reflex</span>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="u-num rounded-full bg-accent-faint px-2 py-0.5 text-[11px] font-semibold text-accent">
                      ×{g.totalHits}
                    </span>
                    <ArrowRight
                      size={14}
                      strokeWidth={1.75}
                      className="shrink-0 text-text-faint"
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty
              title={loading ? 'Loading…' : 'No patterns yet'}
              hint="Name the reusable trick while tagging and it starts counting here."
              className="border-0 py-10"
            />
          )}
        </Card>
      ) : (
        <Card>
          {scopedEntries.length > 0 ? (
            <div>
              {scopedEntries.map(({ row, liveCount }) => {
                const ink = subjectInk(row.subject);
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() =>
                      navigate(`/journal?pattern=${encodeURIComponent(row.name)}`)
                    }
                    className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-bg-overlay/50"
                  >
                    <span
                      className={cn(
                        'u-num w-10 shrink-0 text-[17px] font-semibold',
                        liveCount > 0 ? 'text-text' : 'text-text-faint'
                      )}
                    >
                      ×{liveCount}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">
                        {row.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <span className={cn('h-1.5 w-1.5 rounded-full', ink.dot)} />
                        <span className="text-[11.5px] text-text-muted">
                          {row.subject}
                        </span>
                        <span className="text-[11.5px] text-text-faint">
                          · first seen{' '}
                          {formatDate(row.first_seen_at.slice(0, 10), 'dd MMM')}
                        </span>
                      </span>
                    </span>
                    {row.is_reflexed && <Badge tone="success">reflex</Badge>}
                    <ArrowRight
                      size={14}
                      strokeWidth={1.75}
                      className="shrink-0 text-text-faint"
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty
              title="No patterns for this subject yet"
              hint="Name a trick while tagging a question in this subject to start counting."
              className="border-0 py-10"
            />
          )}
        </Card>
      )}

      <Dialog
        open={confirm !== null}
        onClose={() => !merging && setConfirm(null)}
        title="Merge patterns"
      >
        {confirm && (
          <div className="flex flex-col gap-4">
            <p className="text-[13.5px] leading-relaxed text-text-muted">
              Retag <span className="u-num text-text">{confirm.from.liveCount}</span>{' '}
              {plural(confirm.from.liveCount, 'question')} from{' '}
              <span className="font-medium text-text">
                “{confirm.from.row.name}”
              </span>{' '}
              to{' '}
              <span className="u-highlight font-medium text-text">
                “{confirm.into.row.name}”
              </span>{' '}
              and drop the old name. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                disabled={merging}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={merging}
                onClick={() => void merge(confirm)}
              >
                {merging ? 'Merging…' : 'Merge'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
