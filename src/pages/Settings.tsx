// /settings — full profile round-trip. Every field on the users row that the
// aspirant owns is editable here and saves to Supabase (or to Dexie meta in
// the sandbox). Also handles data export/import, invite management, sign-out.
import { useEffect, useRef, useState } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Check,
  Copy,
  Download,
  LogOut,
  Plus,
  RefreshCcw,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { useAuthStore, type ProfilePatch } from '@/stores/auth';
import { useAuth } from '@/hooks/useAuth';
import { useUiStore } from '@/stores/ui';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { clearLocalData, db } from '@/lib/db';
import {
  EXAM_DATE_DEFAULT,
  INVITE_TTL_DAYS,
  LLM_DAILY_LIMIT,
  TIMEZONES
} from '@/lib/constants';
import { cn, formatDate, todayISO, uuid } from '@/lib/utils';
import {
  BACKUP_VERSION,
  downloadEnvelope,
  exportAll,
  importEnvelope,
  isBackupEnvelope
} from '@/lib/backup';
import type { InviteRow, UserRow } from '@/types';

type FieldEdit<T extends keyof ProfilePatch> = { key: T; value: NonNullable<ProfilePatch[T]> };

function useProfileForm(profile: UserRow | null) {
  const [form, setForm] = useState<UserRow | null>(profile);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    setForm(profile);
    setDirty(new Set());
    setErrors({});
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { form, setForm, saving, setSaving, errors, setErrors, dirty, setDirty };
}

function humanCountdown(exam: string, today: Date): string {
  const days = differenceInCalendarDays(parseISO(exam), today);
  if (days < 0) return `${Math.abs(days)} days past`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `T−${days} days`;
}

export default function Settings() {
  const { userId, sandbox } = useAuth();
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const pushToast = useUiStore((s) => s.pushToast);

  const { form, setForm, saving, setSaving, errors, setErrors, dirty, setDirty } =
    useProfileForm(profile);

  const today = new Date();

  // Field save helpers — save individual fields so the user gets fine-grained
  // feedback (name saves independently of exam_date).
  async function save<T extends keyof ProfilePatch>(edit: FieldEdit<T>) {
    if (!form) return;
    const key = edit.key as string;
    setSaving((prev) => new Set(prev).add(key));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const { error } = await updateProfile({ [edit.key]: edit.value } as ProfilePatch);
    setSaving((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    if (error) {
      setErrors((prev) => ({ ...prev, [key]: error }));
      pushToast(`Save failed: ${error}`, 'neutral');
      return;
    }
    setDirty((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    pushToast(`Saved ${key.replace('_', ' ')}.`, 'success');
  }

  // bind() covers text-typed fields (name / exam_date / target_rank / timezone).
  // The boolean field (sadhana_practice) has its own toggle handler.
  function bind<T extends 'name' | 'exam_date' | 'target_rank' | 'timezone'>(
    key: T,
    coerce?: (raw: string) => ProfilePatch[T]
  ) {
    const raw = form?.[key];
    return {
      value: raw == null ? '' : String(raw),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (!form) return;
        const value = coerce
          ? coerce(e.target.value)
          : (e.target.value as unknown as ProfilePatch[T]);
        setForm({ ...form, [key]: value } as UserRow);
        setDirty((prev) => new Set(prev).add(key as string));
      }
    };
  }

  const daysLeft = form?.exam_date
    ? differenceInCalendarDays(parseISO(form.exam_date), today)
    : 0;

  const [signingOut, setSigningOut] = useState(false);
  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Settings"
        description={
          sandbox
            ? 'Local sandbox — changes save to this device only. Sync is disabled.'
            : 'Everything here syncs to your account. Changes save when you hit “Save”.'
        }
      />

      {/* Identity ------------------------------------------------------------ */}
      <Card>
        <CardHeader
          title="Identity"
          aside={
            <Badge tone={sandbox ? 'warn' : 'neutral'}>
              {sandbox ? 'sandbox' : supabaseConfigured ? 'signed in' : 'no auth'}
            </Badge>
          }
        />
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="u-label" htmlFor="s-name">
              Name
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="s-name"
                {...bind('name')}
                placeholder="How the app addresses you"
                maxLength={80}
                disabled={saving.has('name')}
              />
              {dirty.has('name') && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    void save({ key: 'name', value: (form?.name ?? '').trim() || 'Aspirant' })
                  }
                  disabled={saving.has('name')}
                >
                  {saving.has('name') ? 'Saving…' : 'Save'}
                </Button>
              )}
            </div>
            {errors.name && <p className="text-[11px] text-danger">{errors.name}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <span className="u-label">Email</span>
            <div className="rounded border border-border bg-bg-overlay/40 px-3 py-2 text-[13px] text-text-muted">
              {form?.email ?? '—'}
            </div>
            <p className="text-[11px] text-text-faint">
              Fixed at sign-up. Contact support to change.
            </p>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <span className="u-label">Account id</span>
            <div className="u-num flex items-center gap-2 rounded border border-border bg-bg-overlay/40 px-3 py-2 text-[12px] text-text-muted">
              <span className="truncate">{userId ?? '—'}</span>
              {userId && <CopyButton value={userId} />}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Exam plan ---------------------------------------------------------- */}
      <Card>
        <CardHeader title="Exam plan" aside={<span className="u-num text-[12px] text-accent">{humanCountdown(form?.exam_date ?? EXAM_DATE_DEFAULT, today)}</span>} />
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="u-label" htmlFor="s-exam">
              Exam date
            </label>
            <div className="flex items-center gap-2">
              <Input id="s-exam" type="date" {...bind('exam_date')} disabled={saving.has('exam_date')} />
              {dirty.has('exam_date') && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (!form?.exam_date) return;
                    void save({ key: 'exam_date', value: form.exam_date });
                  }}
                  disabled={saving.has('exam_date')}
                >
                  {saving.has('exam_date') ? 'Saving…' : 'Save'}
                </Button>
              )}
            </div>
            <p className="text-[11px] text-text-faint">
              GATE CS 2027 · officially first Sunday of February. Change if you're targeting a later cohort.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="u-label" htmlFor="s-rank">
              Target AIR
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="s-rank"
                type="number"
                min={1}
                max={100000}
                {...bind('target_rank', (raw) => Math.max(1, Math.round(Number(raw) || 1)))}
                disabled={saving.has('target_rank')}
              />
              {dirty.has('target_rank') && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (form?.target_rank == null) return;
                    void save({ key: 'target_rank', value: form.target_rank });
                  }}
                  disabled={saving.has('target_rank')}
                >
                  {saving.has('target_rank') ? 'Saving…' : 'Save'}
                </Button>
              )}
            </div>
            <p className="text-[11px] text-text-faint">
              Used by the dashboard to frame progress. Not shared with anyone.
            </p>
          </div>
          <div className="sm:col-span-2">
            <ExamRunway examDate={form?.exam_date ?? EXAM_DATE_DEFAULT} daysLeft={daysLeft} />
          </div>
        </CardBody>
      </Card>

      {/* Preferences ------------------------------------------------------- */}
      <Card>
        <CardHeader title="Preferences" />
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="u-label" htmlFor="s-tz">
              Timezone
            </label>
            <div className="flex items-center gap-2">
              <Select id="s-tz" {...bind('timezone')} disabled={saving.has('timezone')}>
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </Select>
              {dirty.has('timezone') && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (!form?.timezone) return;
                    void save({ key: 'timezone', value: form.timezone });
                  }}
                  disabled={saving.has('timezone')}
                >
                  {saving.has('timezone') ? 'Saving…' : 'Save'}
                </Button>
              )}
            </div>
            <p className="text-[11px] text-text-faint">
              Weekly review boundaries and "today" counts are computed in this zone.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="u-label">Sadhana practice</span>
            <SadhanaToggle
              value={!!form?.sadhana_practice}
              saving={saving.has('sadhana_practice')}
              onChange={(v) => {
                if (!form) return;
                setForm({ ...form, sadhana_practice: v });
                void save({ key: 'sadhana_practice', value: v });
              }}
            />
            <p className="text-[11px] text-text-faint">
              When on, sessions can flag a “sadhana done” count. Off means the field is hidden.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Invites ----------------------------------------------------------- */}
      <InvitesCard userId={userId} sandbox={sandbox} />

      {/* Usage ------------------------------------------------------------- */}
      <UsageCard userId={userId} />

      {/* Data -------------------------------------------------------------- */}
      <DataCard profile={profile} />

      {/* Danger zone ------------------------------------------------------- */}
      <Card>
        <CardHeader title="Session" />
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-text-muted">
            Signing out wipes local Dexie storage on this device. Server data stays put.
          </p>
          <Button variant="danger" onClick={() => void onSignOut()} disabled={signingOut}>
            <LogOut size={14} className="mr-1" strokeWidth={1.75} />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          // clipboard denied
        }
      }}
      aria-label="Copy"
      className="rounded p-1 text-text-faint hover:text-text"
    >
      {copied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={1.75} />}
    </button>
  );
}

function SadhanaToggle({
  value,
  saving,
  onChange
}: {
  value: boolean;
  saving: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(!value)}
        disabled={saving}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          value ? 'bg-accent' : 'bg-bg-overlay',
          saving && 'opacity-60'
        )}
        aria-pressed={value}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            value ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
      <span className="text-[12px] text-text-muted">{value ? 'on' : 'off'}</span>
      {saving && <span className="text-[11px] text-text-faint">saving…</span>}
    </div>
  );
}

function ExamRunway({ examDate, daysLeft }: { examDate: string; daysLeft: number }) {
  const [target] = useState(365 * 2); // 2-year runway visualisation cap
  const usedFrac = Math.min(1, Math.max(0, 1 - daysLeft / target));
  return (
    <div className="flex flex-col gap-1 rounded border border-border/70 bg-bg-overlay/40 px-3 py-3">
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="u-label">Runway to {formatDate(examDate, 'dd MMM yyyy')}</span>
        <span className="u-num text-text-muted">
          {Math.max(0, daysLeft)} days · {Math.round(usedFrac * 100)}% of a 2-year plan spent
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-bg-overlay">
        <div
          className="h-2 rounded bg-accent transition-all"
          style={{ width: `${Math.round(usedFrac * 100)}%` }}
        />
      </div>
    </div>
  );
}

function InvitesCard({ userId, sandbox }: { userId: string | null; sandbox: boolean }) {
  const [invites, setInvites] = useState<InviteRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sandbox || !supabaseConfigured || !userId) {
      setInvites([]);
      return;
    }
    void reload();
  }, [userId, sandbox]); // eslint-disable-line react-hooks/exhaustive-deps

  async function reload() {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('invites')
      .select('*')
      .eq('issued_by', userId)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setInvites((data as InviteRow[]) ?? []);
  }

  async function createInvite() {
    if (!userId) return;
    setCreating(true);
    const token = uuid().replace(/-/g, '').slice(0, 24);
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + INVITE_TTL_DAYS);
    const { error } = await supabase.from('invites').insert({
      id: uuid(),
      token,
      issued_by: userId,
      expires_at: expiresAt.toISOString()
    });
    setCreating(false);
    if (error) {
      setError(error.message);
      return;
    }
    void reload();
  }

  if (sandbox || !supabaseConfigured) {
    return (
      <Card>
        <CardHeader title="Invites" />
        <CardBody>
          <p className="text-[12px] text-text-muted">
            Invites need a live account. Sign up with real Supabase to issue and manage them.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Invites"
        aside={
          <div className="flex items-center gap-2">
            {invites && (
              <span className="u-num text-[11px] text-text-faint">
                {invites.filter((i) => !i.used_by).length} unused
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => void reload()} disabled={loading}>
              <RefreshCcw size={12} strokeWidth={1.75} className="mr-1" />
              Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={() => void createInvite()} disabled={creating}>
              <Plus size={12} strokeWidth={1.75} className="mr-1" />
              {creating ? 'Creating…' : 'New invite'}
            </Button>
          </div>
        }
      />
      {error && (
        <div className="border-b border-border/60 px-4 py-2 text-[12px] text-warn">{error}</div>
      )}
      {loading ? (
        <div className="px-4 py-4 text-[12px] text-text-faint">Loading…</div>
      ) : !invites || invites.length === 0 ? (
        <Empty
          title="No invites yet"
          hint={`Generate one to share the ${INVITE_TTL_DAYS}-day link with a buddy.`}
          className="border-0 py-8"
        />
      ) : (
        <ul className="divide-y divide-border">
          {invites.map((inv) => {
            const url = `${window.location.origin}/auth?invite=${inv.token}`;
            const expired = new Date(inv.expires_at) < new Date();
            const used = !!inv.used_by;
            return (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[12px]">
                <span className="u-num truncate text-text-muted">{inv.token}</span>
                {used ? (
                  <Badge tone="success">used</Badge>
                ) : expired ? (
                  <Badge tone="warn">expired</Badge>
                ) : (
                  <Badge tone="neutral">active</Badge>
                )}
                <span className="text-text-faint">
                  expires {formatDate(inv.expires_at.slice(0, 10), 'dd MMM')}
                </span>
                {!used && !expired && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="max-w-[260px] truncate rounded border border-border bg-bg-overlay/40 px-2 py-1 text-[11px] text-text-muted">
                      {url}
                    </span>
                    <CopyButton value={url} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function UsageCard({ userId }: { userId: string | null }) {
  const [today, setToday] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!supabaseConfigured || !userId) {
      setToday(null);
      return;
    }
    setLoading(true);
    void supabase
      .from('llm_usage_daily')
      .select('count')
      .eq('user_id', userId)
      .eq('day', todayISO())
      .maybeSingle()
      .then(({ data }) => {
        setToday(data?.count ?? 0);
        setLoading(false);
      });
  }, [userId]);

  const used = today ?? 0;
  const pct = Math.min(1, used / LLM_DAILY_LIMIT);
  const rowsDex = useLiveQuery(async () => {
    const [q, r, p, f] = await Promise.all([
      db.questions.count(),
      db.reattempts.count(),
      db.patterns.count(),
      db.formulas.count()
    ]);
    return { q, r, p, f };
  });

  return (
    <Card>
      <CardHeader title="Usage" />
      <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBlock label="LLM credits today" value={loading ? '…' : `${used} / ${LLM_DAILY_LIMIT}`}>
          <div className="mt-1 h-1 overflow-hidden rounded bg-bg-overlay">
            <div className="h-1 bg-accent" style={{ width: `${Math.round(pct * 100)}%` }} />
          </div>
        </StatBlock>
        <StatBlock label="Questions logged" value={rowsDex?.q?.toString() ?? '…'} />
        <StatBlock label="Open re-attempts" value={rowsDex?.r?.toString() ?? '…'} />
        <StatBlock label="Patterns / formulas" value={rowsDex ? `${rowsDex.p} / ${rowsDex.f}` : '…'} />
      </CardBody>
    </Card>
  );
}

function StatBlock({
  label,
  value,
  children
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded border border-border/70 bg-bg-overlay/30 px-3 py-2.5">
      <div className="u-label">{label}</div>
      <div className="u-num mt-1 text-[16px] font-semibold text-text">{value}</div>
      {children}
    </div>
  );
}

function DataCard({ profile }: { profile: UserRow | null }) {
  const pushToast = useUiStore((s) => s.pushToast);
  const [busy, setBusy] = useState<'export' | 'import' | 'clear' | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onExport() {
    setBusy('export');
    try {
      const env = await exportAll(profile);
      downloadEnvelope(env);
      pushToast('Backup saved to Downloads.', 'success');
    } catch (err) {
      pushToast(`Export failed: ${(err as Error).message}`, 'neutral');
    } finally {
      setBusy(null);
    }
  }

  async function onImportPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow same-file re-pick
    if (!file) return;
    setBusy('import');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!isBackupEnvelope(parsed)) throw new Error('not a valid backup');
      const report = await importEnvelope(parsed);
      const total = report.reduce((s, r) => s + r.added, 0);
      pushToast(`Imported ${total} rows across ${report.length} tables.`, 'success');
    } catch (err) {
      pushToast(`Import failed: ${(err as Error).message}`, 'neutral');
    } finally {
      setBusy(null);
    }
  }

  async function onClear() {
    setBusy('clear');
    try {
      await clearLocalData();
      pushToast('Local Dexie wiped. Server data untouched.', 'neutral');
    } catch (err) {
      pushToast(`Clear failed: ${(err as Error).message}`, 'neutral');
    } finally {
      setBusy(null);
      setConfirmClear(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Data"
        aside={<span className="text-[11px] text-text-faint">backup v{BACKUP_VERSION}</span>}
      />
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-[13px] font-semibold text-text">Export</p>
            <p className="text-[12px] text-text-muted">
              JSON dump of your local rows (sessions, questions, patterns, re-attempts, formulas,
              doubts, triangulations, phrases, weekly reviews). Buddy-shared rows are excluded.
            </p>
          </div>
          <Button variant="primary" onClick={() => void onExport()} disabled={busy !== null}>
            <Download size={14} strokeWidth={1.75} className="mr-1" />
            {busy === 'export' ? 'Preparing…' : 'Export JSON'}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div>
            <p className="font-display text-[13px] font-semibold text-text">Import</p>
            <p className="text-[12px] text-text-muted">
              Merges rows by id (Dexie put semantics). Newer local edits are preserved.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              onChange={onImportPick}
              className="hidden"
              disabled={busy !== null}
            />
            <Button
              variant="ghost"
              onClick={() => fileRef.current?.click()}
              disabled={busy !== null}
            >
              <Upload size={14} strokeWidth={1.75} className="mr-1" />
              {busy === 'import' ? 'Merging…' : 'Choose file'}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div>
            <p className="font-display text-[13px] font-semibold text-text">Wipe local</p>
            <p className="text-[12px] text-text-muted">
              Deletes Dexie on this device. Next sync pulls back everything from Supabase.
              Sandbox mode loses everything permanently.
            </p>
          </div>
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)} disabled={busy !== null}>
                <X size={12} strokeWidth={1.75} className="mr-1" /> Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={() => void onClear()} disabled={busy !== null}>
                <Trash2 size={12} strokeWidth={1.75} className="mr-1" />
                {busy === 'clear' ? 'Wiping…' : 'Confirm wipe'}
              </Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmClear(true)} disabled={busy !== null}>
              <Trash2 size={14} strokeWidth={1.75} className="mr-1" />
              Wipe local storage
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

