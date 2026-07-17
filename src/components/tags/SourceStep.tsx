// SourceStep — first step in the tag flow: records where the question came
// from (PYQ + year/set, Go Classes quizzes, GATE Overflow, or a scanned "other"
// question), lets the user override the session subject, and captures optional
// question-number / marks. Marks feed target_time_sec (1-mark ~90s, 2-mark ~180s)
// so Journal's "over target" flag reflects reality.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ImageIcon, Trash2, UploadCloud } from 'lucide-react';
import {
  SUBJECTS,
  SOURCE_KINDS,
  PYQ_TWO_SETS_FROM,
  QUESTION_FORMATS,
  pyqYears,
  type QuestionFormat,
  type SourceKind
} from '@/lib/constants';
import { compressToDataUrl, ImageTooLargeError } from '@/lib/image';
import { subtopicsFor } from '@/lib/subtopics';
import { cn } from '@/lib/utils';
import { useKeyboard } from '@/hooks/useKeyboard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Kbd } from '@/components/ui/Kbd';
import type { SourceDraft } from '@/components/tags/sourceDraft';

const YEARS = pyqYears();

function MarksChip({
  value,
  active,
  onClick
}: {
  value: 1 | 2;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-8 min-w-[52px] rounded border px-3 font-mono text-[12px] transition-all duration-150 active:scale-95',
        active
          ? 'border-accent bg-accent-faint font-semibold text-accent shadow-sm'
          : 'border-border bg-bg-raised text-text-muted hover:border-border-hover hover:text-text'
      )}
    >
      {value}m
    </button>
  );
}

function FormatChip({
  value,
  hint,
  active,
  onClick
}: {
  value: QuestionFormat;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={cn(
        'h-8 min-w-[56px] rounded border px-3 font-mono text-[12px] transition-all duration-150 active:scale-95',
        active
          ? 'border-accent bg-accent-faint font-semibold text-accent shadow-sm'
          : 'border-border bg-bg-raised text-text-muted hover:border-border-hover hover:text-text'
      )}
    >
      {value}
    </button>
  );
}

function SetChip({
  value,
  active,
  onClick
}: {
  value: 1 | 2;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-9 min-w-[64px] rounded border px-3 text-[13px] transition-all duration-150 active:scale-95',
        active
          ? 'border-accent bg-accent-faint font-semibold text-accent shadow-sm'
          : 'border-border bg-bg-raised text-text-muted hover:border-border-hover hover:text-text'
      )}
    >
      Set {value}
    </button>
  );
}

export default function SourceStep({
  initial,
  onSubmit,
  onCancel
}: {
  initial: SourceDraft;
  onSubmit: (draft: SourceDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<SourceDraft>(initial);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isPyq = draft.kind === 'pyq';
  const yearHasSets = draft.year != null && draft.year >= PYQ_TWO_SETS_FROM;
  const subtopics = useMemo(() => subtopicsFor(draft.subject), [draft.subject]);
  const activeSubtopicSpec = subtopics.find((s) => s.value === draft.subtopic);

  useEffect(() => {
    if (!isPyq) return;
    if (draft.year == null) return;
    if (draft.year < PYQ_TWO_SETS_FROM && draft.set !== null) {
      setDraft((d) => ({ ...d, set: null }));
    } else if (draft.year >= PYQ_TWO_SETS_FROM && draft.set === null) {
      setDraft((d) => ({ ...d, set: 1 }));
    }
  }, [draft.year, draft.set, isPyq]);

  // Clear subtopic when subject switches — the list is subject-scoped.
  useEffect(() => {
    if (!draft.subtopic) return;
    const stillValid = subtopics.some((s) => s.value === draft.subtopic);
    if (!stillValid) setDraft((d) => ({ ...d, subtopic: null }));
  }, [draft.subject, draft.subtopic, subtopics]);

  useKeyboard(
    {
      escape: onCancel,
      ...Object.fromEntries(
        SOURCE_KINDS.map((s) => [s.key, () => setDraft((d) => ({ ...d, kind: s.value }))])
      )
    },
    !uploading
  );

  const yearOptions = useMemo(() => YEARS, []);

  async function pickImage(file: File | undefined) {
    if (!file) return;
    setImageError(null);
    setUploading(true);
    try {
      const compressed = await compressToDataUrl(file);
      setDraft((d) => ({ ...d, imageDataUrl: compressed.dataUrl }));
    } catch (err) {
      if (err instanceof ImageTooLargeError) setImageError(err.message);
      else setImageError('Could not read that image.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function submit() {
    // Normalize: non-PYQ drops year+set; PYQ without year still allowed (user may not remember)
    const normalized: SourceDraft = {
      ...draft,
      subtopic: draft.subtopic?.trim() ? draft.subtopic.trim() : null,
      year: isPyq ? draft.year : null,
      set: isPyq && yearHasSets ? draft.set : null,
      questionNumber: draft.questionNumber?.trim() ? draft.questionNumber.trim() : null,
      imageDataUrl: isPyq ? null : draft.imageDataUrl // PYQs don't attach an image (source is unambiguous)
    };
    onSubmit(normalized);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="u-label" htmlFor="src-subject">
            Subject
          </label>
          <Select
            id="src-subject"
            value={draft.subject}
            onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="u-label" htmlFor="src-kind">
            Source
          </label>
          <Select
            id="src-kind"
            value={draft.kind}
            onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as SourceKind }))}
          >
            {SOURCE_KINDS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="u-label" htmlFor="src-subtopic">
          Subtopic (optional)
        </label>
        <Select
          id="src-subtopic"
          value={draft.subtopic ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, subtopic: e.target.value || null }))}
        >
          <option value="">— pick a subtopic</option>
          {subtopics.map((s) => (
            <option key={s.value} value={s.value}>
              {s.value}
            </option>
          ))}
        </Select>
        {activeSubtopicSpec?.relatedSubjects?.length ? (
          <p className="text-[11px] text-text-faint">
            Often crosses into:{' '}
            {activeSubtopicSpec.relatedSubjects.map((s, i) => (
              <span key={s}>
                {i > 0 && ', '}
                <span className="text-text-muted">{s}</span>
              </span>
            ))}
          </p>
        ) : null}
      </div>

      {isPyq ? (
        <div className="flex flex-col gap-3 rounded border border-border/70 bg-bg-overlay/40 px-3 py-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
            <div className="flex flex-col gap-1.5">
              <label className="u-label" htmlFor="src-year">
                Year
              </label>
              <Select
                id="src-year"
                value={draft.year ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    year: e.target.value ? Number(e.target.value) : null
                  }))
                }
              >
                <option value="">Don't remember</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            {yearHasSets && (
              <div className="flex flex-col gap-1.5">
                <span className="u-label">Set</span>
                <div className="flex flex-wrap gap-2">
                  <SetChip
                    value={1}
                    active={draft.set === 1}
                    onClick={() => setDraft((d) => ({ ...d, set: 1 }))}
                  />
                  <SetChip
                    value={2}
                    active={draft.set === 2}
                    onClick={() => setDraft((d) => ({ ...d, set: 2 }))}
                  />
                </div>
              </div>
            )}
          </div>
          {draft.year != null && !yearHasSets && (
            <p className="text-[12px] text-text-faint">
              GATE {draft.year} was a single-set exam — sets only started in {PYQ_TWO_SETS_FROM}.
            </p>
          )}
        </div>
      ) : (
        <ImageUpload
          dataUrl={draft.imageDataUrl}
          uploading={uploading}
          error={imageError}
          fileRef={fileRef}
          onPick={(f) => void pickImage(f)}
          onClear={() => {
            setImageError(null);
            setDraft((d) => ({ ...d, imageDataUrl: null }));
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="flex flex-col gap-1.5">
          <label className="u-label" htmlFor="src-qnum">
            Question # (optional)
          </label>
          <Input
            id="src-qnum"
            value={draft.questionNumber ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, questionNumber: e.target.value }))}
            placeholder="e.g. Q23"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="u-label">Format</span>
          <div className="flex items-center gap-1.5">
            {QUESTION_FORMATS.map((qf) => (
              <FormatChip
                key={qf.value}
                value={qf.value}
                hint={qf.hint}
                active={draft.format === qf.value}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    format: d.format === qf.value ? null : qf.value
                  }))
                }
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="u-label">Marks</span>
          <div className="flex items-center gap-1.5">
            <MarksChip
              value={1}
              active={draft.marks === 1}
              onClick={() =>
                setDraft((d) => ({ ...d, marks: d.marks === 1 ? null : 1 }))
              }
            />
            <MarksChip
              value={2}
              active={draft.marks === 2}
              onClick={() =>
                setDraft((d) => ({ ...d, marks: d.marks === 2 ? null : 2 }))
              }
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <p className="text-[12px] text-text-faint">
          <Kbd>1</Kbd>–<Kbd>6</Kbd> pick source · <Kbd>Esc</Kbd> back
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={submit} disabled={uploading}>
            Skip details
          </Button>
          <Button variant="primary" onClick={submit} disabled={uploading}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImageUpload({
  dataUrl,
  uploading,
  error,
  fileRef,
  onPick,
  onClear
}: {
  dataUrl: string | null;
  uploading: boolean;
  error: string | null;
  fileRef: React.RefObject<HTMLInputElement>;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="u-label">Question image</span>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => onPick(e.target.files?.[0])}
        className="hidden"
      />
      {dataUrl ? (
        <div className="flex items-start gap-3 rounded border border-border bg-bg-raised p-2 shadow-sm">
          <img
            src={dataUrl}
            alt="Uploaded question"
            className="h-24 w-24 shrink-0 rounded object-cover"
          />
          <div className="flex flex-1 flex-col gap-2 text-[12px] text-text-muted">
            <span>
              Attached. Full-size preview available from Journal — click the thumbnail.
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="text-danger hover:text-danger"
              >
                <Trash2 size={14} strokeWidth={1.75} className="mr-1" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className={cn(
            'flex items-center gap-3 rounded border border-dashed border-border bg-bg-overlay/40 px-4 py-4 text-left transition-colors',
            'hover:border-border-hover hover:bg-bg-overlay/70 disabled:opacity-60'
          )}
        >
          {uploading ? (
            <ImageIcon size={20} strokeWidth={1.75} className="text-text-faint" />
          ) : (
            <UploadCloud size={20} strokeWidth={1.75} className="text-accent" />
          )}
          <span className="flex flex-1 flex-col">
            <span className="text-[13px] font-medium text-text">
              {uploading ? 'Compressing…' : 'Upload / snap image'}
            </span>
            <span className="text-[12px] text-text-faint">
              Photo of the question. Auto-resized to 1400px, stored locally.
            </span>
          </span>
        </button>
      )}
      {error && (
        <p className="flex items-center gap-1.5 text-[12px] text-danger">
          <AlertCircle size={12} strokeWidth={2} />
          {error}
        </p>
      )}
    </div>
  );
}
