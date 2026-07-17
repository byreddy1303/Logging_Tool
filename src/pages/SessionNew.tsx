import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SessionRow } from '@/types';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { SUBJECTS, TARGET_DURATIONS_MIN, QUESTION_COUNT_CHOICES } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import { useKeyboard } from '@/hooks/useKeyboard';
import { useSessionStore } from '@/stores/session';
import { writeLocal } from '@/lib/sync';
import { cn, uuid, todayISO, nowISO } from '@/lib/utils';

function Segmented({
  options,
  value,
  onChange
}: {
  options: { value: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex divide-x divide-border overflow-hidden rounded border border-border">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'h-9 px-4 font-mono text-[13px] transition-colors',
            value === o.value
              ? 'bg-bg-overlay text-text'
              : 'text-text-muted hover:bg-bg-overlay/60 hover:text-text'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function SessionNew() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const begin = useSessionStore((s) => s.begin);
  const [subject, setSubject] = useState<string>();
  const [duration, setDuration] = useState<number>(60);
  const [count, setCount] = useState<number>(10);
  const [starting, setStarting] = useState(false);

  async function start() {
    if (!subject || !userId || starting) return;
    setStarting(true);
    const row: SessionRow = {
      id: uuid(),
      user_id: userId,
      date: todayISO(),
      subject,
      target_duration_min: duration,
      actual_duration_min: null,
      insight: null,
      sadhana_done: false,
      interruptions_count: 0,
      created_at: nowISO()
    };
    await writeLocal('sessions', row);
    begin(row.id, count);
    navigate(`/session/${row.id}/solve`);
  }

  useKeyboard({ enter: () => void start() }, !!subject);

  return (
    <div>
      <PageHeader
        title="New session"
        description="Pick the block, start the clock, tag every question as you go."
      />
      <Card>
        <CardBody className="flex flex-col gap-6">
          <div>
            <p className="u-label mb-2">Subject</p>
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
              {SUBJECTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSubject(s)}
                  className={cn(
                    'border px-3 py-2.5 text-left text-[13px] transition-colors',
                    subject === s
                      ? 'border-accent bg-bg-overlay text-text'
                      : 'border-border text-text-muted hover:border-border-hover hover:text-text'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <p className="u-label mb-2">Target duration</p>
              <Segmented
                options={TARGET_DURATIONS_MIN.map((m) => ({ value: m, label: `${m}m` }))}
                value={duration}
                onChange={setDuration}
              />
            </div>
            <div>
              <p className="u-label mb-2">Questions</p>
              <Segmented options={QUESTION_COUNT_CHOICES} value={count} onChange={setCount} />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-[12px] text-text-faint">
              {subject ? (
                <>
                  <Kbd>Enter</Kbd> <span className="ml-1">starts the clock</span>
                </>
              ) : (
                'Pick a subject to arm the session.'
              )}
            </p>
            <Button variant="primary" disabled={!subject || starting} onClick={() => void start()}>
              Start session
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
