// F4.3 — parallel three-provider explanation with a required user conclusion.
// The router fans out to Groq / Gemini / OpenRouter, logs the row to
// `triangulate_logs`, and returns the row id. On Save we update that row with
// the user's conclusion and a one-line disagreement summary. LLMs never write
// the conclusion; the button is disabled until the user does.
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertCircle, Copy, Loader2, Save, Send, X } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Empty } from '@/components/ui/Empty';
import { Badge } from '@/components/ui/Badge';
import { useLLM } from '@/hooks/useLLM';
import { useAuth } from '@/hooks/useAuth';
import { usePrefsStore } from '@/stores/prefs';
import { Dialog } from '@/components/ui/Dialog';
import { db } from '@/lib/db';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import {
  alignParagraphs,
  summariseDisagreement,
  type AlignedRow
} from '@/lib/triangulate';
import { LLMError, type LLMTriangulateResponse } from '@/lib/llm';
import { cn, formatDate } from '@/lib/utils';

const PROVIDER_LABELS = ['Groq · Llama 3.3', 'Gemini 2.5 Pro', 'OpenRouter · DeepSeek R1'] as const;

interface AskState {
  prompt: string;
  data: LLMTriangulateResponse | null;
  conclusion: string;
  saving: boolean;
  saved: boolean;
}

const INITIAL: AskState = {
  prompt: '',
  data: null,
  conclusion: '',
  saving: false,
  saved: false
};

export default function Triangulate() {
  const { userId } = useAuth();
  const [state, setState] = useState<AskState>(INITIAL);
  const { send, pending, error, reset } = useLLM();
  const [flash, setFlash] = useState<string | null>(null);
  const triangulateConfirm = usePrefsStore((s) => s.triangulateConfirm);
  const [confirming, setConfirming] = useState(false);

  const rows: AlignedRow[] = useMemo(() => {
    if (!state.data) return [];
    const [g, m, o] = state.data.responses;
    return alignParagraphs(g.response, m.response, o.response);
  }, [state.data]);

  const summary = useMemo(() => summariseDisagreement(rows), [rows]);

  const history = useLiveQuery(
    async () => {
      if (!userId) return [];
      const rowsAll = await db.triangulate_logs.where('user_id').equals(userId).toArray();
      return rowsAll.sort((a, b) => (a.created_at > b.created_at ? -1 : 1)).slice(0, 6);
    },
    [userId],
    []
  );

  function set<K extends keyof AskState>(key: K, val: AskState[K]) {
    setState((s) => ({ ...s, [key]: val }));
  }

  async function fireAsk() {
    if (!state.prompt.trim() || pending) return;
    setState((s) => ({ ...s, data: null, conclusion: '', saved: false }));
    reset();
    const resp = await send({
      use_case: 'triangulate',
      prompt: state.prompt.trim(),
      template: 'triangulate'
    });
    if (resp && resp.use_case === 'triangulate') {
      setState((s) => ({ ...s, data: resp as LLMTriangulateResponse }));
    }
  }

  function ask() {
    if (!state.prompt.trim() || pending) return;
    if (triangulateConfirm) {
      setConfirming(true);
      return;
    }
    void fireAsk();
  }

  function confirmAndAsk() {
    setConfirming(false);
    void fireAsk();
  }

  function clear() {
    setState(INITIAL);
    reset();
  }

  async function save() {
    if (!state.data || !state.conclusion.trim() || state.saving) return;
    set('saving', true);
    try {
      const disagreementNote = `${summary.disagreeing}/${summary.total} paragraphs diverge (min Jaccard ${
        summary.minScore != null ? summary.minScore.toFixed(2) : '—'
      })`;
      // If Supabase is configured, update the row the router created. Local
      // sandbox mode has no server row to update — silently skip.
      if (supabaseConfigured) {
        await supabase
          .from('triangulate_logs')
          .update({
            user_conclusion: state.conclusion.trim(),
            disagreement_noted: disagreementNote
          })
          .eq('id', state.data.triangulate_id);
      }
      set('saved', true);
      setFlash('Saved to log');
      setTimeout(() => setFlash(null), 1800);
    } finally {
      set('saving', false);
    }
  }

  async function copyRow(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFlash('Copied');
      setTimeout(() => setFlash(null), 1200);
    } catch {
      // clipboard denied
    }
  }

  const canAsk = state.prompt.trim().length >= 3 && !pending;
  const canSave = !!state.data && state.conclusion.trim().length >= 5 && !state.saved;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Triangulate"
        description="Same question, three models. Read across, write your own conclusion — the models never write it for you."
      />

      <Card>
        <CardHeader
          title="Question"
          aside={
            flash ? (
              <span className="text-[11px] text-success">{flash}</span>
            ) : (
              <span className="text-[11px] text-text-faint">
                counts as 3 credits toward the daily 100
              </span>
            )
          }
        />
        <CardBody className="flex flex-col gap-3">
          <Textarea
            value={state.prompt}
            onChange={(e) => set('prompt', e.target.value)}
            placeholder="Paste the question exactly. Ambiguous phrasing is fine — that's often what triangulating is for."
            rows={5}
            disabled={pending}
            maxLength={4000}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <span className="u-num text-[11px] text-text-faint">
              {state.prompt.trim().length} chars
            </span>
            <div className="flex items-center gap-2">
              {(state.prompt || state.data) && (
                <Button variant="ghost" size="sm" onClick={clear} disabled={pending || state.saving}>
                  Clear
                </Button>
              )}
              <Button variant="primary" onClick={() => ask()} disabled={!canAsk}>
                {pending ? (
                  <>
                    <Loader2 size={14} className="mr-1 animate-spin" strokeWidth={1.75} />
                    Asking three models…
                  </>
                ) : (
                  <>
                    <Send size={14} className="mr-1" strokeWidth={1.75} />
                    Ask all three
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {error && <ErrorCard error={error} onRetry={() => void fireAsk()} onDismiss={reset} />}

      {state.data && (
        <>
          <Card>
            <CardHeader
              title="Three answers"
              aside={
                <div className="flex items-center gap-2 text-[11px] text-text-faint">
                  <Badge tone={summary.disagreeing > 0 ? 'warn' : 'success'}>
                    {summary.disagreeing > 0
                      ? `${summary.percent}% divergence`
                      : 'agreement'}
                  </Badge>
                  <span className="u-num">
                    {summary.disagreeing}/{summary.total} rows
                  </span>
                </div>
              }
            />
            <CardBody className="overflow-x-auto p-0">
              <table className="w-full min-w-[720px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.06em] text-text-muted">
                    <th className="w-[30px] px-3 py-2 font-mono text-text-faint">#</th>
                    {PROVIDER_LABELS.map((label) => (
                      <th key={label} className="px-3 py-2 font-mono">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr
                      key={row.index}
                      className={cn(
                        row.disagreement && 'bg-warn/5'
                      )}
                    >
                      <td className="u-num px-3 py-2 align-top text-[11px] text-text-faint">
                        {row.index + 1}
                      </td>
                      {row.cells.map((cell, i) => (
                        <td key={i} className="px-3 py-2 align-top">
                          {cell ? (
                            <div className="group relative whitespace-pre-wrap text-text-muted">
                              <span>{cell}</span>
                              <button
                                type="button"
                                onClick={() => void copyRow(cell)}
                                aria-label="Copy paragraph"
                                className="absolute right-0 top-0 rounded p-1 text-text-faint opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
                              >
                                <Copy size={11} strokeWidth={1.75} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-text-faint">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Your conclusion"
              aside={
                <span className="text-[11px] text-text-faint">
                  Required — this is the whole point of triangulating.
                </span>
              }
            />
            <CardBody className="flex flex-col gap-3">
              <Textarea
                value={state.conclusion}
                onChange={(e) => set('conclusion', e.target.value)}
                placeholder="One sentence. What you now believe is the answer and why. Do not paraphrase any model."
                rows={4}
                maxLength={800}
                disabled={state.saving}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-[11px] text-text-faint">
                  {state.conclusion.trim().length} chars
                </span>
                <div className="flex items-center gap-2">
                  {state.saved && (
                    <span className="text-[12px] text-success">Logged.</span>
                  )}
                  <Button variant="primary" onClick={() => void save()} disabled={!canSave}>
                    {state.saving ? (
                      <>
                        <Loader2 size={14} className="mr-1 animate-spin" strokeWidth={1.75} />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Save size={14} className="mr-1" strokeWidth={1.75} />
                        Save conclusion
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </>
      )}

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Spend 3 credits?"
        className="max-w-md"
      >
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-text-muted">
            Triangulate hits Groq, Gemini and OpenRouter in parallel — that counts as three
            calls against today's 100-credit cap. Turn this confirmation off in Settings if you're
            OK spending without the check.
          </p>
          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmAndAsk}>
              Ask all three
            </Button>
          </div>
        </div>
      </Dialog>

      <Card>
        <CardHeader title="Recent triangulations" />
        {history.length === 0 ? (
          <Empty
            title="Nothing here yet"
            hint="Prior triangulations sync down after the router logs them. Your saved conclusion + divergence note appear once the pull sync runs."
            className="border-0 py-8"
          />
        ) : (
          <ul className="divide-y divide-border">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col gap-1 px-4 py-3 text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="u-num text-text-faint">
                    {formatDate(h.created_at.slice(0, 10), 'dd MMM')}
                  </span>
                  {h.disagreement_noted && (
                    <Badge tone="warn">{h.disagreement_noted}</Badge>
                  )}
                </div>
                <p className="truncate text-text-muted">{h.prompt.slice(0, 240)}</p>
                {h.user_conclusion && (
                  <p className="text-text">
                    <span className="text-text-faint">conclusion:</span> {h.user_conclusion}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ErrorCard({
  error,
  onRetry,
  onDismiss
}: {
  error: LLMError;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const isQuota = error.code === 'quota';
  const title =
    error.code === 'quota'
      ? 'Daily AI quota reached'
      : error.code === 'unauth'
        ? 'Sign in to use AI'
        : error.code === 'not_configured'
          ? 'Not available in local sandbox'
          : error.code === 'provider'
            ? 'One or more providers failed'
            : 'Something went wrong';
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <AlertCircle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warn" />
        <div className="flex-1">
          <p className="font-display text-[13px] font-semibold text-text">{title}</p>
          <p className="text-[12px] text-text-muted">{error.message}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isQuota && error.code !== 'not_configured' && (
            <Button variant="ghost" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error"
            className="rounded p-1 text-text-faint hover:text-text"
          >
            <X size={13} strokeWidth={1.75} />
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
