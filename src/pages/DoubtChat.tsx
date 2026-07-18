// F4.2 — structured doubt chat. Three fields (topic, current understanding,
// stuck point) auto-wrap into BUILD.md §9.1's six-part template. Nothing the
// user types is ever piped into outcome / root_cause. Users can optionally
// attach the doubt to a journal question — this only sets the `question_id`
// the router logs on `doubt_sessions`; it never edits the question row.
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertCircle, Copy, Loader2, Send, Sparkles, X, Zap } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Empty } from '@/components/ui/Empty';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import MarkdownLite from '@/components/shared/MarkdownLite';
import { useLLM } from '@/hooks/useLLM';
import { useAuth } from '@/hooks/useAuth';
import { usePrefsStore } from '@/stores/prefs';
import { db } from '@/lib/db';
import { quickExplainPrompt } from '@/lib/prompts';
import { formatDate, cn } from '@/lib/utils';
import { LLMError, type LLMSingleResponse } from '@/lib/llm';
import type { QuestionRow } from '@/types';

type Mode = 'quick' | 'deep';

interface FormState {
  topic: string;
  understanding: string;
  stuck: string;
  attachQuestionId: string;
  mode: Mode;
}

function initialForm(defaultMode: Mode): FormState {
  return {
    topic: '',
    understanding: '',
    stuck: '',
    attachQuestionId: '',
    mode: defaultMode
  };
}

function ModeToggle({
  value,
  onChange,
  disabled
}: {
  value: Mode;
  onChange: (m: Mode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center rounded border border-border bg-bg-raised p-0.5 text-[12px] shadow-sm">
      <button
        type="button"
        onClick={() => onChange('quick')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors',
          value === 'quick' ? 'bg-accent-faint text-accent' : 'text-text-muted hover:text-text',
          disabled && 'opacity-60'
        )}
      >
        <Zap size={12} strokeWidth={1.75} /> Quick
        <span className="text-text-faint">Groq</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('deep')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors',
          value === 'deep' ? 'bg-accent-faint text-accent' : 'text-text-muted hover:text-text',
          disabled && 'opacity-60'
        )}
      >
        <Sparkles size={12} strokeWidth={1.75} /> Deep
        <span className="text-text-faint">Gemini</span>
      </button>
    </div>
  );
}

export default function DoubtChat() {
  const { userId } = useAuth();
  const defaultDoubtMode = usePrefsStore((s) => s.defaultDoubtMode);
  const [form, setForm] = useState<FormState>(() => initialForm(defaultDoubtMode));
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [copyFlash, setCopyFlash] = useState(false);
  const { send, pending, error, data, reset } = useLLM();

  // Attach picker: user's own questions, most recent first. Kept small (25).
  const questions = useLiveQuery(
    async () => {
      if (!userId) return [] as QuestionRow[];
      const rows = await db.questions
        .where('user_id')
        .equals(userId)
        .reverse()
        .sortBy('created_at');
      return rows.slice(0, 25);
    },
    [userId],
    []
  );

  // Prior doubt sessions surface after a pull sync — read-only history.
  const history = useLiveQuery(
    async () => {
      if (!userId) return [];
      const rows = await db.doubt_sessions.where('user_id').equals(userId).toArray();
      return rows.sort((a, b) => (a.created_at > b.created_at ? -1 : 1)).slice(0, 8);
    },
    [userId],
    []
  );

  const promptPreview = useMemo(
    () =>
      quickExplainPrompt({
        topic: form.topic || '<TOPIC>',
        currentUnderstanding: form.understanding || '<CURRENT UNDERSTANDING>',
        stuckPoint: form.stuck || '<STUCK POINT>'
      }),
    [form.topic, form.understanding, form.stuck]
  );

  const dirty = form.topic || form.understanding || form.stuck;

  const canAsk = form.topic.trim().length >= 2 && form.stuck.trim().length >= 2 && !pending;

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function ask() {
    if (!canAsk) return;
    reset();
    const prompt = quickExplainPrompt({
      topic: form.topic.trim(),
      currentUnderstanding: form.understanding.trim() || 'not stated',
      stuckPoint: form.stuck.trim()
    });
    await send({
      use_case: form.mode === 'quick' ? 'quick_explain' : 'deep_doubt',
      prompt,
      question_id: form.attachQuestionId || null,
      template: form.mode === 'quick' ? 'quick_explain' : 'deep_doubt'
    });
  }

  function clear() {
    setForm(initialForm(defaultDoubtMode));
    reset();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 1400);
    } catch {
      // Clipboard blocked — no-op.
    }
  }

  const single = data && data.use_case !== 'triangulate' ? (data as LLMSingleResponse) : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Ask a doubt"
        description="Three fields become a full six-part explanation. Your words never touch outcome or root-cause tags."
      />

      <Card>
        <CardHeader
          title="Frame the question"
          aside={<ModeToggle value={form.mode} onChange={(m) => set('mode', m)} disabled={pending} />}
        />
        <CardBody className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="u-label" htmlFor="doubt-topic">
              Topic
            </label>
            <Input
              id="doubt-topic"
              value={form.topic}
              onChange={(e) => set('topic', e.target.value)}
              placeholder="e.g. Finite automata minimisation"
              disabled={pending}
              maxLength={200}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="u-label" htmlFor="doubt-understanding">
              What you already understand <span className="text-text-faint">(optional)</span>
            </label>
            <Textarea
              id="doubt-understanding"
              value={form.understanding}
              onChange={(e) => set('understanding', e.target.value)}
              placeholder="Where you'd start. Any invariants you're using."
              disabled={pending}
              rows={3}
              maxLength={1500}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="u-label" htmlFor="doubt-stuck">
              Where you're stuck
            </label>
            <Textarea
              id="doubt-stuck"
              value={form.stuck}
              onChange={(e) => set('stuck', e.target.value)}
              placeholder="What specifically feels wrong. The step where you froze."
              disabled={pending}
              rows={3}
              maxLength={1500}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="u-label" htmlFor="doubt-attach">
              Attach to a question <span className="text-text-faint">(optional)</span>
            </label>
            <Select
              id="doubt-attach"
              value={form.attachQuestionId}
              onChange={(e) => set('attachQuestionId', e.target.value)}
              disabled={pending || questions.length === 0}
            >
              <option value="">{questions.length === 0 ? 'no questions logged yet' : 'none — general doubt'}</option>
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
                  {`${formatDate(q.created_at.slice(0, 10), 'dd MMM')} · ${q.subject} · ${q.source_ref ?? 'no ref'}`}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowFullPrompt((s) => !s)}
              className="text-[11px] text-text-faint underline decoration-dotted underline-offset-2 hover:text-text-muted"
            >
              {showFullPrompt ? 'hide prompt' : 'preview full prompt'}
            </button>
            <div className="flex items-center gap-2">
              {dirty && (
                <Button variant="ghost" size="sm" onClick={clear} disabled={pending}>
                  Clear
                </Button>
              )}
              <Button variant="primary" onClick={() => void ask()} disabled={!canAsk}>
                {pending ? (
                  <>
                    <Loader2 size={14} className="mr-1 animate-spin" strokeWidth={1.75} />
                    Thinking…
                  </>
                ) : (
                  <>
                    <Send size={14} className="mr-1" strokeWidth={1.75} />
                    Ask
                  </>
                )}
              </Button>
            </div>
          </div>

          {showFullPrompt && (
            <pre className="max-h-64 overflow-y-auto rounded border border-border bg-bg-overlay px-3 py-2 font-mono text-[11.5px] leading-relaxed text-text-muted">
              {promptPreview}
            </pre>
          )}
        </CardBody>
      </Card>

      {error && <ErrorCard error={error} onRetry={() => void ask()} onDismiss={reset} />}

      {single && (
        <Card>
          <CardHeader
            title="Answer"
            aside={
              <div className="flex items-center gap-2 text-[11px] text-text-faint">
                <Badge tone="neutral">{single.provider}</Badge>
                <span className="u-num">{Math.round(single.latency_ms)} ms</span>
                <button
                  type="button"
                  onClick={() => void copy(single.response)}
                  className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-text-muted hover:text-text"
                  aria-label="Copy answer"
                >
                  <Copy size={11} strokeWidth={1.75} />
                  {copyFlash ? 'copied' : 'copy'}
                </button>
              </div>
            }
          />
          <CardBody>
            <MarkdownLite text={single.response} />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Recent doubts"
          aside={
            history.length > 0 ? (
              <span className="u-num text-[11px] text-text-faint">{history.length}</span>
            ) : undefined
          }
        />
        {history.length === 0 ? (
          <Empty
            title="No prior sessions here yet"
            hint="Answers you ask for will show up here across sessions once the pull sync runs."
            className="border-0 py-8"
          />
        ) : (
          <ul className="divide-y divide-border">
            {history.map((h) => (
              <li key={h.id} className="flex items-start gap-3 px-4 py-2 text-[12px]">
                <span className="u-num text-text-faint">
                  {formatDate(h.created_at.slice(0, 10), 'dd MMM')}
                </span>
                <Badge tone="neutral">{h.provider}</Badge>
                <span className="truncate text-text-muted">{h.user_input.slice(0, 200)}</span>
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
            ? 'Provider unavailable'
            : 'Something went wrong';
  const detail = isQuota
    ? error.retryAfter
      ? `Fresh 100 credits at ${formatDate(error.retryAfter.slice(0, 10), 'dd MMM')} 00:00 UTC.`
      : 'Fresh 100 credits at UTC midnight.'
    : error.message;
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <AlertCircle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warn" />
        <div className="flex-1">
          <p className="font-display text-[13px] font-semibold text-text">{title}</p>
          <p className="text-[12px] text-text-muted">{detail}</p>
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
