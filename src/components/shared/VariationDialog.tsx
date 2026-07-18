// F4.4 — variation generator dialog. Given an eligible parent question (W-*,
// RBS, or RBG), call the router with the `variation` prompt, parse the "1..5"
// response into 5 items, let the user tick any subset, and insert selected
// `variations` rows with added_to_reattempt=true. The re-attempt ladder entry
// happens later, when the user records an outcome for the variation on
// /reattempts — same rules as any tagged question.
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { useLLM } from '@/hooks/useLLM';
import { useAuth } from '@/hooks/useAuth';
import { writeLocal } from '@/lib/sync';
import { variationPrompt, parseVariations } from '@/lib/prompts';
import { nowISO, uuid } from '@/lib/utils';
import type { QuestionRow, VariationRow } from '@/types';
import type { LLMSingleResponse } from '@/lib/llm';

interface Props {
  parent: QuestionRow | null;
  open: boolean;
  onClose: () => void;
  onSaved?: (variationIds: string[]) => void;
}

function questionSeed(parent: QuestionRow): string {
  const parts: string[] = [];
  if (parent.question_text) parts.push(parent.question_text);
  if (parent.pattern_name) parts.push(`(pattern: ${parent.pattern_name})`);
  if (parent.source_ref) parts.push(`[from ${parent.source_ref}]`);
  if (parts.length === 0) parts.push(`GATE CS ${parent.subject} question tagged ${parent.outcome}`);
  return parts.join('\n');
}

export default function VariationDialog({ parent, open, onClose, onSaved }: Props) {
  const { userId } = useAuth();
  const { send, pending, error, data, reset } = useLLM();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      reset();
      setSelected(new Set());
      setSaving(false);
    }
  }, [open, reset]);

  const variants = useMemo<string[]>(() => {
    if (!data || data.use_case === 'triangulate') return [];
    return parseVariations((data as LLMSingleResponse).response);
  }, [data]);

  async function generate() {
    if (!parent) return;
    reset();
    setSelected(new Set());
    await send({
      use_case: 'variation',
      prompt: variationPrompt(questionSeed(parent)),
      question_id: parent.id,
      template: 'variation'
    });
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function saveSelected() {
    if (!parent || !userId || selected.size === 0) return;
    setSaving(true);
    try {
      const rows: VariationRow[] = [...selected].map((i) => ({
        id: uuid(),
        user_id: userId,
        parent_question_id: parent.id,
        generated_text: variants[i],
        added_to_reattempt: true,
        created_at: nowISO()
      }));
      for (const row of rows) await writeLocal('variations', row);
      onSaved?.(rows.map((r) => r.id));
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const eligible = parent && parent.outcome !== 'R';
  const canSave = variants.length > 0 && selected.size > 0 && !saving;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (pending || saving) return;
        onClose();
      }}
      title="Generate variations"
      className="max-w-2xl"
    >
      {!parent ? (
        <Empty
          title="No parent question"
          hint="Open this from a question row to seed the generator."
          className="border-0 py-8"
        />
      ) : !eligible ? (
        <Empty
          title="Only for missed / slow / guessed questions"
          hint="Variations are meant to reinforce a shaky concept. If you got it clean, move on."
          className="border-0 py-8"
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 rounded border border-border/70 bg-bg-overlay/40 px-3 py-2 text-[12px]">
            <span className="u-label">Parent</span>
            <span className="text-text">
              {parent.pattern_name ?? <span className="text-text-faint">untitled mistake</span>}
            </span>
            <span className="text-text-faint">
              {parent.subject} · {parent.outcome} · {parent.source_ref ?? 'no source ref'}
            </span>
          </div>

          {variants.length === 0 && (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <span className="text-[12px] text-text-muted">
                Fires the `variation` prompt against Groq. Costs 1 credit.
              </span>
              <Button variant="primary" onClick={() => void generate()} disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 size={14} className="mr-1 animate-spin" strokeWidth={1.75} />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} className="mr-1" strokeWidth={1.75} />
                    Generate 5
                  </>
                )}
              </Button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded border border-warn/60 bg-warn/5 px-3 py-2 text-[12px] text-text">
              <span className="mt-0.5 text-warn">!</span>
              <div className="flex-1">
                <p className="font-medium">
                  {error.code === 'quota' ? 'Quota reached' : error.code === 'unauth' ? 'Sign in' : 'Failed to generate'}
                </p>
                <p className="text-text-muted">{error.message}</p>
              </div>
              <button
                type="button"
                onClick={reset}
                aria-label="Dismiss"
                className="rounded p-1 text-text-faint hover:text-text"
              >
                <X size={12} strokeWidth={1.75} />
              </button>
            </div>
          )}

          {variants.length > 0 && (
            <>
              <ul className="flex flex-col divide-y divide-border rounded border border-border">
                {variants.map((v, i) => {
                  const on = selected.has(i);
                  return (
                    <li key={i} className="flex items-start gap-3 px-3 py-3">
                      <label className="flex flex-1 cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(i)}
                          className="mt-1 h-3.5 w-3.5 accent-accent"
                          disabled={saving}
                        />
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <Badge tone="neutral">#{i + 1}</Badge>
                          </div>
                          <p className="whitespace-pre-wrap text-[13px] text-text">{v}</p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-[12px] text-text-muted">
                  {selected.size} selected · will queue in /reattempts
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => void generate()} disabled={pending || saving}>
                    Regenerate
                  </Button>
                  <Button variant="primary" onClick={() => void saveSelected()} disabled={!canSave}>
                    {saving
                      ? 'Adding…'
                      : selected.size === 0
                        ? 'Pick at least one'
                        : `Add ${selected.size} to queue`}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
