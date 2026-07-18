// F4.6 — trigger-phrase reflex drill. Shows a phrase (e.g. "longest common
// subsequence"), you type the concept it should trigger ("DP"), Cerebras
// scores MATCH / MISS. Response time is measured client-side from the moment
// the phrase renders to submit — that's the metric that matters for the
// "reflex" claim, not the router latency alone.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Loader2, Play, Plus, Timer, Trash2, XCircle } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Empty } from '@/components/ui/Empty';
import { Badge } from '@/components/ui/Badge';
import { useLLM } from '@/hooks/useLLM';
import { useAuth } from '@/hooks/useAuth';
import { useUiStore } from '@/stores/ui';
import { db } from '@/lib/db';
import { writeLocal, deleteLocal } from '@/lib/sync';
import { nowISO, uuid } from '@/lib/utils';
import { reflexScorePrompt, parseReflexResult } from '@/lib/prompts';
import type { TriggerPhraseRow } from '@/types';
import type { LLMSingleResponse } from '@/lib/llm';

interface Attempt {
  phraseId: string;
  answer: string;
  reflexMs: number;
  latencyMs: number;
  result: 'MATCH' | 'MISS' | 'UNKNOWN';
  at: number;
}

function orderQueue(phrases: TriggerPhraseRow[]): TriggerPhraseRow[] {
  // Unpracticed first (nulls first), then slowest reflex first.
  return [...phrases].sort((a, b) => {
    if (a.reflex_time_ms === null && b.reflex_time_ms === null) return 0;
    if (a.reflex_time_ms === null) return -1;
    if (b.reflex_time_ms === null) return 1;
    return b.reflex_time_ms - a.reflex_time_ms;
  });
}

export default function TriggerDrill() {
  const { userId } = useAuth();
  const pushToast = useUiStore((s) => s.pushToast);

  const phrases = useLiveQuery(
    async () => {
      if (!userId) return [] as TriggerPhraseRow[];
      return db.trigger_phrases.where('user_id').equals(userId).toArray();
    },
    [userId],
    []
  );

  // Add-phrase form
  const [newPhrase, setNewPhrase] = useState('');
  const [newConcept, setNewConcept] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  // Drill state
  const [current, setCurrent] = useState<TriggerPhraseRow | null>(null);
  const [answer, setAnswer] = useState('');
  const [phraseShownAt, setPhraseShownAt] = useState<number | null>(null);
  const [reflexMs, setReflexMs] = useState<number | null>(null); // last attempt
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const answerRef = useRef<HTMLInputElement>(null);
  const { send, pending, error, reset } = useLLM();

  const queue = useMemo(() => orderQueue(phrases), [phrases]);

  useEffect(() => {
    if (current && answerRef.current) answerRef.current.focus();
  }, [current]);

  async function addPhrase() {
    if (!userId || !newPhrase.trim() || !newConcept.trim() || addSaving) return;
    setAddSaving(true);
    try {
      const row: TriggerPhraseRow = {
        id: uuid(),
        user_id: userId,
        phrase: newPhrase.trim(),
        concept: newConcept.trim(),
        reflex_time_ms: null,
        question_ids: [],
        created_at: nowISO()
      };
      await writeLocal('trigger_phrases', row);
      setNewPhrase('');
      setNewConcept('');
    } finally {
      setAddSaving(false);
    }
  }

  function startDrill() {
    const next = queue[0];
    if (!next) return;
    setCurrent(next);
    setAnswer('');
    setReflexMs(null);
    setAttempts([]);
    reset();
    setPhraseShownAt(performance.now());
  }

  function nextPhrase(skipCurrent = false) {
    if (!current) return;
    const rest = queue.filter((p) => p.id !== current.id);
    const nxt = skipCurrent ? rest[0] ?? null : rest[0] ?? null;
    setCurrent(nxt);
    setAnswer('');
    setReflexMs(null);
    reset();
    setPhraseShownAt(nxt ? performance.now() : null);
  }

  async function submit() {
    if (!current || !phraseShownAt || !answer.trim() || pending) return;
    const elapsed = Math.round(performance.now() - phraseShownAt);
    setReflexMs(elapsed);
    const resp = await send({
      use_case: 'reflex_score',
      prompt: reflexScorePrompt({
        phrase: current.phrase,
        canonical: current.concept,
        userAnswer: answer.trim()
      }),
      template: 'reflex_score'
    });
    if (!resp || resp.use_case === 'triangulate') return;
    const single = resp as LLMSingleResponse;
    const parsed = parseReflexResult(single.response) ?? 'UNKNOWN';
    const attempt: Attempt = {
      phraseId: current.id,
      answer: answer.trim(),
      reflexMs: elapsed,
      latencyMs: single.latency_ms,
      result: parsed,
      at: Date.now()
    };
    setAttempts((prev) => [attempt, ...prev].slice(0, 20));
    if (parsed === 'MATCH') {
      // Persist best reflex time (min).
      const best =
        current.reflex_time_ms == null ? elapsed : Math.min(current.reflex_time_ms, elapsed);
      await writeLocal('trigger_phrases', { ...current, reflex_time_ms: best });
      pushToast(`MATCH · ${elapsed} ms`, 'success');
    } else if (parsed === 'MISS') {
      pushToast(`MISS · canonical: ${current.concept}`, 'neutral');
    }
  }

  async function removePhrase(row: TriggerPhraseRow) {
    await deleteLocal('trigger_phrases', row.id);
    if (current?.id === row.id) setCurrent(null);
  }

  const p95 = useMemo(() => {
    if (attempts.length < 2) return null;
    const totals = [...attempts].map((a) => a.latencyMs).sort((a, b) => a - b);
    return totals[Math.floor(totals.length * 0.95) - 1] ?? null;
  }, [attempts]);

  const canAdd = newPhrase.trim().length >= 2 && newConcept.trim().length >= 1 && !addSaving;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Trigger drill"
        description="Phrase → concept, timed. Cerebras scores you MATCH or MISS. Fast + right beats slow + right."
      />

      <Card>
        <CardHeader
          title="Add phrase"
          aside={<span className="text-[11px] text-text-faint">phrase, then canonical concept</span>}
        />
        <CardBody className="flex flex-col gap-2">
          <Input
            value={newPhrase}
            onChange={(e) => setNewPhrase(e.target.value)}
            placeholder='e.g. "longest common subsequence"'
            disabled={addSaving}
            maxLength={200}
          />
          <Input
            value={newConcept}
            onChange={(e) => setNewConcept(e.target.value)}
            placeholder='e.g. "DP on two strings"'
            disabled={addSaving}
            maxLength={200}
          />
          <div className="flex items-center justify-end border-t border-border pt-2">
            <Button variant="primary" size="sm" onClick={() => void addPhrase()} disabled={!canAdd}>
              <Plus size={14} strokeWidth={1.75} className="mr-1" />
              Add
            </Button>
          </div>
        </CardBody>
      </Card>

      {phrases.length === 0 ? (
        <Empty
          title="Add at least one phrase to start drilling"
          hint="Add the phrases whose concept should be reflex-fast. During the drill, Cerebras checks your answer in a second or less."
        />
      ) : !current ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-[14px] font-semibold text-text">
                {queue.length} {queue.length === 1 ? 'phrase' : 'phrases'} in the queue
              </p>
              <p className="text-[12px] text-text-muted">
                Unpracticed / slowest go first. You can skip anytime.
              </p>
            </div>
            <Button variant="primary" onClick={startDrill}>
              <Play size={14} strokeWidth={1.75} className="mr-1" />
              Start drill
            </Button>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Reflex"
            aside={
              <div className="flex items-center gap-3 text-[11px] text-text-faint">
                {p95 !== null && (
                  <span>
                    p95 <span className="u-num text-text-muted">{p95} ms</span>
                  </span>
                )}
                <span>
                  {attempts.length}/{queue.length} attempts
                </span>
              </div>
            }
          />
          <CardBody className="flex flex-col gap-3">
            <div className="rounded border border-border/70 bg-bg-overlay/40 px-4 py-4 text-center">
              <span className="font-display text-[18px] font-semibold text-text">
                {current.phrase}
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                ref={answerRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !pending) void submit();
                }}
                placeholder="Concept this phrase should trigger"
                disabled={pending}
                maxLength={200}
                className="flex-1"
              />
              <Button variant="primary" onClick={() => void submit()} disabled={pending || !answer.trim()}>
                {pending ? (
                  <>
                    <Loader2 size={14} className="mr-1 animate-spin" strokeWidth={1.75} />
                    Scoring…
                  </>
                ) : (
                  <>Submit</>
                )}
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <div className="flex items-center gap-2 text-[12px] text-text-faint">
                <Timer size={12} strokeWidth={1.75} />
                {reflexMs === null ? (
                  <span>time starts when the phrase appears</span>
                ) : (
                  <span>
                    reflex <span className="u-num text-text-muted">{reflexMs} ms</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => nextPhrase(true)} disabled={pending}>
                  Skip
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCurrent(null)} disabled={pending}>
                  End drill
                </Button>
              </div>
            </div>
            {error && (
              <p className="text-[12px] text-warn">
                {error.code === 'quota'
                  ? 'Daily quota reached.'
                  : error.code === 'unauth'
                    ? 'Sign in to score.'
                    : error.message}
              </p>
            )}
            {attempts.length > 0 && (
              <ul className="mt-1 flex flex-col gap-1">
                {attempts.slice(0, 5).map((a) => (
                  <li
                    key={`${a.phraseId}-${a.at}`}
                    className="flex items-center gap-2 rounded border border-border bg-bg-raised px-2 py-1.5 text-[12px]"
                  >
                    {a.result === 'MATCH' ? (
                      <CheckCircle2 size={12} className="text-success" strokeWidth={2} />
                    ) : a.result === 'MISS' ? (
                      <XCircle size={12} className="text-danger" strokeWidth={2} />
                    ) : (
                      <span className="h-3 w-3 rounded-full bg-warn/50" />
                    )}
                    <span className="text-text-muted">{a.answer}</span>
                    <span className="u-num ml-auto text-text-faint">
                      reflex {a.reflexMs} · scored {a.latencyMs} ms
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
          <div className="flex items-center justify-end border-t border-border p-3">
            <Button variant="ghost" size="sm" onClick={() => nextPhrase(false)} disabled={pending}>
              Next phrase →
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Library"
          aside={<span className="u-num text-[11px] text-text-faint">{phrases.length}</span>}
        />
        {phrases.length === 0 ? (
          <Empty title="No phrases yet" hint="Add one above." className="border-0 py-8" />
        ) : (
          <ul className="divide-y divide-border">
            {queue.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate font-medium text-text">{p.phrase}</span>
                <span className="text-text-muted">→ {p.concept}</span>
                {p.reflex_time_ms !== null ? (
                  <Badge tone={p.reflex_time_ms <= 2000 ? 'success' : 'warn'}>
                    {p.reflex_time_ms} ms
                  </Badge>
                ) : (
                  <Badge tone="neutral">unpracticed</Badge>
                )}
                <button
                  type="button"
                  onClick={() => void removePhrase(p)}
                  aria-label="Delete phrase"
                  className="rounded p-1 text-text-faint hover:text-danger"
                >
                  <Trash2 size={12} strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
