import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Kbd } from '@/components/ui/Kbd';
import { Tabs } from '@/components/ui/Tabs';
import { Empty } from '@/components/ui/Empty';
import { Progress } from '@/components/ui/Progress';
import { Dialog } from '@/components/ui/Dialog';
import { toast } from '@/stores/ui';
import { SUBJECTS } from '@/lib/constants';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="u-label">{title}</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export default function DevPrimitives() {
  const [tab, setTab] = useState('one');
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-8 px-4 py-8">
      <header>
        <h1 className="font-mono text-lg font-medium">/dev/primitives</h1>
        <p className="mt-1 text-[13px] text-text-muted">Visual QA for every UI primitive. Dev only.</p>
      </header>

      <Section title="Buttons">
        <Button variant="primary">Start session</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Delete</Button>
        <Button variant="primary" size="sm">
          Small
        </Button>
        <Button variant="secondary" disabled>
          Disabled
        </Button>
      </Section>

      <Section title="Inputs">
        <Input placeholder="Pattern name (3-5 words)" className="max-w-[240px]" />
        <Input mono placeholder="GATE CS 2019 Q23" className="max-w-[200px]" />
        <Select className="max-w-[220px]" defaultValue="">
          <option value="" disabled>
            Subject
          </option>
          {SUBJECTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Textarea placeholder="Trigger sentence — the exact phrase that should fire the concept" />
      </Section>

      <Section title="Badges">
        <Badge>R</Badge>
        <Badge tone="warn">RBS</Badge>
        <Badge tone="accent">RBG</Badge>
        <Badge tone="danger">W-C</Badge>
        <Badge tone="success">Mastered</Badge>
        <Badge tone="neutral">D10</Badge>
      </Section>

      <Section title="Keyboard">
        <span className="flex items-center gap-2 text-[13px] text-text-muted">
          Outcome keys <Kbd>r</Kbd>
          <Kbd>s</Kbd>
          <Kbd>g</Kbd>
          <Kbd>1</Kbd>
          <Kbd>2</Kbd>
          <Kbd>3</Kbd> then <Kbd>Enter</Kbd>
        </span>
      </Section>

      <Section title="Progress">
        <div className="w-full max-w-[320px]">
          <Progress value={62} />
        </div>
        <div className="w-full max-w-[320px]">
          <Progress value={31} tone="danger" />
        </div>
      </Section>

      <section>
        <h2 className="u-label">Tabs</h2>
        <Tabs
          className="mt-3"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'one', label: 'Patterns' },
            { value: 'two', label: 'Re-attempts' },
            { value: 'three', label: 'Weekly' }
          ]}
        />
        <p className="u-num mt-3 text-xs text-text-muted">active: {tab}</p>
      </section>

      <section>
        <h2 className="u-label">Card</h2>
        <Card className="mt-3">
          <CardHeader title="Due today" aside={<Badge tone="accent">4</Badge>} />
          <CardBody>
            <p className="text-[13px] text-text-muted">
              Card body content sits on the raised surface with a hairline header rule.
            </p>
          </CardBody>
        </Card>
      </section>

      <section>
        <h2 className="u-label">Empty state</h2>
        <Empty
          className="mt-3"
          title="No questions tagged yet"
          hint="Start a session and tag your first PYQ. The journal builds itself from there."
          action={<Button variant="primary">Start session</Button>}
        />
      </section>

      <Section title="Feedback">
        <Button onClick={() => toast('Tag saved · synced', 'success')}>Success toast</Button>
        <Button onClick={() => toast('Sync failed — will retry', 'danger')}>Danger toast</Button>
        <Button onClick={() => toast('3 re-attempts due today')}>Neutral toast</Button>
        <Button variant="secondary" onClick={() => setDialogOpen(true)}>
          Open dialog
        </Button>
      </Section>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Merge patterns">
        <p className="text-[13px] text-text-muted">
          Merge <span className="u-num text-text">pigeonhole on remainders</span> into{' '}
          <span className="u-num text-text">pigeonhole remainder classes</span>? 7 questions will be
          re-pointed.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setDialogOpen(false);
              toast('Patterns merged', 'success');
            }}
          >
            Merge
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
