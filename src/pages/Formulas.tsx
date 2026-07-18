// F4.5 — formula library + extractor. Text mode: paste any chapter and Groq
// structures it. Image mode: upload a photo of a page/whiteboard and Gemini
// vision transcribes each formula in LaTeX. Both flows land in the same
// review-and-approve UI. Kept formulas go into `formulas` with next_review=
// today so they show up at the top of the review list immediately.
import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertCircle,
  Camera,
  ClipboardPaste,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  UploadCloud,
  X
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Empty } from '@/components/ui/Empty';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useLLM } from '@/hooks/useLLM';
import { useAuth } from '@/hooks/useAuth';
import { useUiStore } from '@/stores/ui';
import { db } from '@/lib/db';
import { writeLocal, deleteLocal } from '@/lib/sync';
import { SUBJECTS } from '@/lib/constants';
import { addDaysISO, cn, formatDate, nowISO, todayISO, uuid } from '@/lib/utils';
import { subjectInk } from '@/lib/subjectInk';
import { compressToDataUrl, ImageTooLargeError } from '@/lib/image';
import {
  formulaExtractImagePrompt,
  formulaExtractPrompt,
  parseFormulaExtraction
} from '@/lib/prompts';
import type { FormulaRow } from '@/types';
import type { LLMSingleResponse } from '@/lib/llm';

type ExtractMode = 'text' | 'image';

interface Candidate {
  name: string;
  expression: string;
  when_to_use: string;
}

const DEFAULT_SUBJECT = SUBJECTS[0];
const REVIEW_INTERVALS = [3, 10, 30];

function nextReviewOnRecall(row: FormulaRow, today: string): string {
  // Simple: bump through the intervals; once we're past D30, stay at D30.
  const cur = row.last_reviewed ?? row.created_at.slice(0, 10);
  const gap = Math.round((new Date(today).getTime() - new Date(cur).getTime()) / 86_400_000);
  const nextIdx = REVIEW_INTERVALS.findIndex((d) => d > gap);
  const delay = nextIdx === -1 ? REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1] : REVIEW_INTERVALS[nextIdx];
  return addDaysISO(today, delay);
}

export default function Formulas() {
  const { userId } = useAuth();
  const today = todayISO();
  const pushToast = useUiStore((s) => s.pushToast);

  const [mode, setMode] = useState<ExtractMode>('text');
  const [text, setText] = useState('');
  const [subject, setSubject] = useState<string>(DEFAULT_SUBJECT);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageBytes, setImageBytes] = useState(0);
  const [imageError, setImageError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { send, pending, error, data, reset } = useLLM();

  const candidates = useMemo<Candidate[]>(() => {
    if (!data || data.use_case === 'triangulate') return [];
    return parseFormulaExtraction((data as LLMSingleResponse).response);
  }, [data]);

  const formulas = useLiveQuery(
    async () => {
      if (!userId) return [] as FormulaRow[];
      const rows = await db.formulas.where('user_id').equals(userId).toArray();
      return rows;
    },
    [userId],
    []
  );

  const bySubject = useMemo(() => {
    const map = new Map<string, FormulaRow[]>();
    for (const f of formulas) {
      const list = map.get(f.subject) ?? [];
      list.push(f);
      map.set(f.subject, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [formulas]);

  const dueToday = useMemo(
    () => formulas.filter((f) => f.next_review <= today),
    [formulas, today]
  );

  const canExtractText = text.trim().length >= 20 && !pending && !preparing;
  const canExtractImage = !!imageDataUrl && !pending && !preparing;
  const canExtract = mode === 'text' ? canExtractText : canExtractImage;
  const canSave = candidates.length > 0 && selected.size > 0 && !saving;

  async function extract() {
    if (!canExtract) return;
    reset();
    setSelected(new Set());
    if (mode === 'text') {
      await send({
        use_case: 'formula_extract',
        prompt: formulaExtractPrompt(text.trim()),
        template: 'formula_extract'
      });
      return;
    }
    // image mode
    if (!imageDataUrl) return;
    const commaIdx = imageDataUrl.indexOf(',');
    const b64 = commaIdx >= 0 ? imageDataUrl.slice(commaIdx + 1) : imageDataUrl;
    await send({
      use_case: 'formula_extract_image',
      prompt: formulaExtractImagePrompt(),
      template: 'formula_extract_image',
      image_base64: b64,
      image_mime_type: 'image/jpeg'
    });
  }

  async function pickImage(file: File | undefined) {
    if (!file) return;
    setImageError(null);
    setPreparing(true);
    try {
      const c = await compressToDataUrl(file);
      setImageDataUrl(c.dataUrl);
      setImageBytes(c.bytes);
    } catch (err) {
      if (err instanceof ImageTooLargeError) setImageError(err.message);
      else setImageError((err as Error).message || 'Could not read image.');
    } finally {
      setPreparing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function clearImage() {
    setImageDataUrl(null);
    setImageBytes(0);
    setImageError(null);
    reset();
    setSelected(new Set());
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(candidates.map((_, i) => i)));
  }

  async function saveSelected() {
    if (!userId || !canSave) return;
    setSaving(true);
    try {
      const rows: FormulaRow[] = [...selected].map((i) => ({
        id: uuid(),
        user_id: userId,
        name: candidates[i].name,
        subject,
        expression: candidates[i].expression,
        forgot_count: 0,
        last_reviewed: null,
        next_review: today,
        created_at: nowISO()
      }));
      for (const row of rows) await writeLocal('formulas', row);
      pushToast(`Added ${rows.length} to the library.`, 'success');
      reset();
      setSelected(new Set());
      setText('');
      clearImage();
    } finally {
      setSaving(false);
    }
  }

  async function markRecalled(row: FormulaRow) {
    const updated: FormulaRow = {
      ...row,
      last_reviewed: today,
      next_review: nextReviewOnRecall(row, today)
    };
    await writeLocal('formulas', updated);
  }

  async function markForgot(row: FormulaRow) {
    const updated: FormulaRow = {
      ...row,
      forgot_count: row.forgot_count + 1,
      last_reviewed: today,
      next_review: addDaysISO(today, REVIEW_INTERVALS[0])
    };
    await writeLocal('formulas', updated);
  }

  async function remove(row: FormulaRow) {
    await deleteLocal('formulas', row.id);
  }

  async function pasteClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setText(t);
    } catch {
      // clipboard denied
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Formulas"
        description="Paste text or upload a photo. Groq structures typed notes; Gemini vision transcribes photos — everything routes to the same review-and-approve step."
      />

      <Card>
        <CardHeader
          title="Extract"
          aside={
            <div className="flex items-center gap-2 text-[11px] text-text-faint">
              <label className="u-label" htmlFor="fx-subject">
                Subject
              </label>
              <Select
                id="fx-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={pending || saving}
                className="text-[12px]"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
        <CardBody className="flex flex-col gap-3">
          <div className="inline-flex self-start divide-x divide-border overflow-hidden rounded border border-border bg-bg-raised text-[12.5px]">
            <button
              type="button"
              onClick={() => setMode('text')}
              disabled={pending || saving}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 transition-colors',
                mode === 'text' ? 'bg-accent-faint font-semibold text-accent' : 'text-text-muted hover:bg-bg-overlay hover:text-text'
              )}
            >
              <ClipboardPaste size={12} strokeWidth={1.75} />
              Text
            </button>
            <button
              type="button"
              onClick={() => setMode('image')}
              disabled={pending || saving}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 transition-colors',
                mode === 'image' ? 'bg-accent-faint font-semibold text-accent' : 'text-text-muted hover:bg-bg-overlay hover:text-text'
              )}
            >
              <ImageIcon size={12} strokeWidth={1.75} />
              Photo
              <span className="rounded bg-bg-overlay px-1 py-0.5 font-mono text-[10px] text-text-faint">Gemini</span>
            </button>
          </div>

          {mode === 'text' ? (
            <>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste a chapter / notes / summary. Min 20 chars. Malformed rows in the model output are dropped."
                rows={6}
                maxLength={20_000}
                disabled={pending || saving}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <div className="flex items-center gap-2 text-[11px] text-text-faint">
                  <span className="u-num">{text.trim().length}</span> chars ·
                  <button
                    type="button"
                    onClick={() => void pasteClipboard()}
                    disabled={pending || saving}
                    className="flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-text-muted"
                  >
                    <ClipboardPaste size={11} strokeWidth={1.75} />
                    paste from clipboard
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {text && (
                    <Button variant="ghost" size="sm" onClick={() => setText('')} disabled={pending || saving}>
                      Clear
                    </Button>
                  )}
                  <Button variant="primary" onClick={() => void extract()} disabled={!canExtract}>
                    {pending ? (
                      <>
                        <Loader2 size={14} className="mr-1 animate-spin" strokeWidth={1.75} />
                        Extracting…
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} className="mr-1" strokeWidth={1.75} />
                        Extract formulas
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => void pickImage(e.target.files?.[0])}
                className="hidden"
              />
              {imageDataUrl ? (
                <div className="flex flex-col gap-3 rounded border border-border bg-bg-raised p-2 shadow-sm sm:flex-row sm:items-start">
                  <img
                    src={imageDataUrl}
                    alt="formula source"
                    className="h-40 w-full rounded object-contain sm:w-40"
                  />
                  <div className="flex flex-1 flex-col justify-between gap-2">
                    <div className="text-[12px] text-text-muted">
                      Attached · <span className="u-num">{Math.round(imageBytes / 1024)}</span>{' '}
                      KB post-compression. Preview above matches what Gemini sees.
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={pending || saving || preparing}>
                        <UploadCloud size={12} strokeWidth={1.75} className="mr-1" />
                        Replace
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearImage}
                        disabled={pending || saving || preparing}
                        className="text-danger hover:text-danger"
                      >
                        <Trash2 size={12} strokeWidth={1.75} className="mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={preparing}
                  className={cn(
                    'flex w-full items-center gap-3 rounded border border-dashed border-border bg-bg-overlay/40 px-4 py-6 text-left',
                    'hover:border-border-hover hover:bg-bg-overlay/70 disabled:opacity-60'
                  )}
                >
                  <Camera size={18} strokeWidth={1.75} className="text-accent" />
                  <div className="flex-1">
                    <p className="font-display text-[13px] font-semibold text-text">
                      {preparing ? 'Compressing…' : 'Upload / snap a photo'}
                    </p>
                    <p className="text-[12px] text-text-muted">
                      Image is downscaled to 1400 px on the long edge and sent to Gemini 2.5 Flash.
                      Any file &gt; 6 MB after compression is refused.
                    </p>
                  </div>
                </button>
              )}
              {imageError && (
                <p className="flex items-center gap-1 text-[12px] text-danger">
                  <AlertCircle size={12} strokeWidth={2} />
                  {imageError}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <p className="text-[11px] text-text-faint">
                  Response is strict JSON — malformed rows are silently dropped, LaTeX is preserved verbatim.
                </p>
                <Button variant="primary" onClick={() => void extract()} disabled={!canExtract}>
                  {pending ? (
                    <>
                      <Loader2 size={14} className="mr-1 animate-spin" strokeWidth={1.75} />
                      Reading image…
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="mr-1" strokeWidth={1.75} />
                      Extract from photo
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {error && (
        <Card>
          <CardBody className="flex items-start gap-3">
            <AlertCircle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warn" />
            <div className="flex-1">
              <p className="font-display text-[13px] font-semibold text-text">
                {error.code === 'quota' ? 'Daily AI quota reached' : 'Failed to extract'}
              </p>
              <p className="text-[12px] text-text-muted">{error.message}</p>
            </div>
            <button
              type="button"
              onClick={reset}
              aria-label="Dismiss"
              className="rounded p-1 text-text-faint hover:text-text"
            >
              <X size={13} strokeWidth={1.75} />
            </button>
          </CardBody>
        </Card>
      )}

      {data && (
        <Card>
          <CardHeader
            title={candidates.length === 0 ? 'No formulas found' : `Candidates (${candidates.length})`}
            aside={
              candidates.length > 0 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-[11px] text-text-faint underline decoration-dotted underline-offset-2 hover:text-text"
                  >
                    select all
                  </button>
                  <span className="text-[11px] text-text-faint">
                    {selected.size} chosen
                  </span>
                </div>
              ) : undefined
            }
          />
          {candidates.length === 0 ? (
            <Empty
              title="Model returned nothing structured"
              hint="Try pasting a section with explicit equations, or a summary with named identities."
              className="border-0 py-8"
            />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {candidates.map((c, i) => {
                const on = selected.has(i);
                return (
                  <label
                    key={i}
                    className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-bg-overlay/40"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(i)}
                      disabled={saving}
                      className="mt-1 h-3.5 w-3.5 accent-accent"
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-display text-[14px] font-semibold text-text">
                          {c.name}
                        </span>
                        <code className="rounded bg-bg-overlay px-1.5 py-0.5 font-mono text-[12.5px] text-accent">
                          {c.expression}
                        </code>
                      </div>
                      <p className="mt-0.5 text-[12px] text-text-muted">{c.when_to_use}</p>
                    </div>
                  </label>
                );
              })}
              <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
                <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>
                  Discard
                </Button>
                <Button variant="primary" onClick={() => void saveSelected()} disabled={!canSave}>
                  {saving ? 'Adding…' : selected.size === 0 ? 'Pick at least one' : `Add ${selected.size}`}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {dueToday.length > 0 && (
        <Card>
          <CardHeader
            title="Due today"
            aside={
              <span className="u-num text-[11px] text-text-faint">
                {dueToday.length}
              </span>
            }
          />
          <ul className="divide-y divide-border">
            {dueToday.map((f) => (
              <FormulaReviewRow
                key={f.id}
                row={f}
                onRecalled={() => void markRecalled(f)}
                onForgot={() => void markForgot(f)}
                onDelete={() => void remove(f)}
              />
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Library"
          aside={
            <span className="u-num text-[11px] text-text-faint">
              {formulas.length}
            </span>
          }
        />
        {formulas.length === 0 ? (
          <Empty
            title="Nothing saved yet"
            hint="Paste a chapter above to get started. Or add one from another view — /log's editor can also fill this later."
            className="border-0 py-8"
          />
        ) : (
          <div className="flex flex-col">
            {bySubject.map(([subj, rows]) => {
              const ink = subjectInk(subj);
              return (
                <div key={subj}>
                  <div className="flex items-center gap-2 border-b border-border/60 bg-bg-overlay/30 px-4 py-2 text-[11px] uppercase tracking-[0.06em] text-text-muted">
                    <span className={`h-1.5 w-1.5 rounded-full ${ink.dot}`} />
                    <span className={`font-medium ${ink.text}`}>{subj}</span>
                    <span className="u-num ml-auto text-text-faint">{rows.length}</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {rows.map((f) => (
                      <FormulaLibraryRow key={f.id} row={f} onDelete={() => void remove(f)} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function FormulaReviewRow({
  row,
  onRecalled,
  onForgot,
  onDelete
}: {
  row: FormulaRow;
  onRecalled: () => void;
  onForgot: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-display font-semibold text-text">{row.name}</span>
          <code className="rounded bg-bg-overlay px-1.5 py-0.5 font-mono text-[12px] text-accent">
            {row.expression}
          </code>
        </div>
        <p className="text-[11.5px] text-text-faint">
          due {formatDate(row.next_review, 'dd MMM')} ·{' '}
          {row.forgot_count > 0 && `forgot ${row.forgot_count}× · `}
          {row.last_reviewed
            ? `last ${formatDate(row.last_reviewed, 'dd MMM')}`
            : 'never reviewed'}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={onForgot}>
          <RotateCcw size={12} strokeWidth={1.75} className="mr-1" />
          Forgot
        </Button>
        <Button variant="primary" size="sm" onClick={onRecalled}>
          Recalled
        </Button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete formula"
          className="rounded p-1 text-text-faint hover:text-danger"
        >
          <Trash2 size={12} strokeWidth={1.75} />
        </button>
      </div>
    </li>
  );
}

function FormulaLibraryRow({ row, onDelete }: { row: FormulaRow; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.name);
  const [expression, setExpression] = useState(row.expression);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !expression.trim()) return;
    setSaving(true);
    try {
      await writeLocal('formulas', { ...row, name: name.trim(), expression: expression.trim() });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-bg-overlay/30">
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-col gap-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            <Input
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="Expression"
              className="font-mono"
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-display font-semibold text-text">{row.name}</span>
            <code className="rounded bg-bg-overlay px-1.5 py-0.5 font-mono text-[12px] text-accent">
              {row.expression}
            </code>
            {row.forgot_count > 0 && (
              <Badge tone="warn">{row.forgot_count} forgot</Badge>
            )}
          </div>
        )}
        <p className="text-[11px] text-text-faint">
          next review {formatDate(row.next_review, 'dd MMM')}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {editing ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => void save()} disabled={saving}>
              Save
            </Button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[11px] text-text-faint underline decoration-dotted underline-offset-2 hover:text-text"
            >
              edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete formula"
              className="rounded p-1 text-text-faint hover:text-danger"
            >
              <Trash2 size={12} strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>
    </li>
  );
}
