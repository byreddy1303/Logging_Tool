// Daily digest preferences: email + WhatsApp toggles, phone number,
// preferred local hour. "Send now" button re-fires the digest edge fn for
// this user (useful for validating a template change).
import { useMemo, useState } from 'react';
import { Bell, Send } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import type { UserRow } from '@/types';

interface Props {
  profile: UserRow | null;
  sandbox: boolean;
}

const E164_RE = /^\+[1-9]\d{7,14}$/;

export default function NotificationsCard({ profile, sandbox }: Props) {
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const pushToast = useUiStore((s) => s.pushToast);
  const [phone, setPhone] = useState(profile?.phone_e164 ?? '');
  const [sending, setSending] = useState(false);
  const hourOptions = useMemo(
    () => Array.from({ length: 24 }, (_, h) => ({ value: h, label: `${String(h).padStart(2, '0')}:00` })),
    []
  );

  if (sandbox || !supabaseConfigured || !profile) return null;

  async function patch(patch: Partial<UserRow>) {
    if (!profile) return;
    const { error } = await supabase.from('users').update(patch).eq('id', profile.id);
    if (error) {
      pushToast(error.message, 'neutral');
      return false;
    }
    await refreshProfile();
    return true;
  }

  async function saveEmailToggle(v: boolean) {
    if (await patch({ digest_email_enabled: v })) {
      pushToast(v ? 'Email digest on.' : 'Email digest off.', 'success');
    }
  }

  async function saveWaToggle(v: boolean) {
    if (v && !profile?.phone_e164) {
      pushToast('Add your phone number in E.164 format first (e.g. +919xxxxxxxxx).', 'neutral');
      return;
    }
    if (await patch({ digest_whatsapp_enabled: v })) {
      pushToast(v ? 'WhatsApp digest on.' : 'WhatsApp digest off.', 'success');
    }
  }

  async function savePhone() {
    const cleaned = phone.trim();
    if (cleaned && !E164_RE.test(cleaned)) {
      pushToast('Phone must be E.164, e.g. +919000000000.', 'neutral');
      return;
    }
    if (await patch({ phone_e164: cleaned || null })) {
      pushToast('Phone saved.', 'success');
    }
  }

  async function saveHour(h: number) {
    if (await patch({ digest_hour_local: h })) {
      pushToast(`Digest hour set to ${String(h).padStart(2, '0')}:00.`, 'success');
    }
  }

  async function sendNow() {
    if (!profile) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('daily-digest', {
      body: { user_id: profile.id, force: true }
    });
    setSending(false);
    if (error) {
      pushToast(error.message, 'neutral');
      return;
    }
    const report = ((data as { report?: { email_ok?: boolean; wa_ok?: boolean; email_err?: string; wa_err?: string }[] })?.report ?? [])[0];
    if (report?.email_ok || report?.wa_ok) {
      pushToast(
        `Sent · email: ${report?.email_ok ? 'ok' : 'off'}, whatsapp: ${report?.wa_ok ? 'ok' : 'off'}`,
        'success'
      );
    } else {
      pushToast(
        `Digest fired but nothing delivered. email: ${report?.email_err ?? 'off'} · wa: ${report?.wa_err ?? 'off'}`,
        'neutral'
      );
    }
  }

  return (
    <Card id="digest">
      <CardHeader
        title="Daily digest"
        aside={
          <Button variant="ghost" size="sm" onClick={() => void sendNow()} disabled={sending}>
            <Send size={11} strokeWidth={1.75} className="mr-1" />
            {sending ? 'Sending…' : 'Send now'}
          </Button>
        }
      />
      <CardBody className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <Bell size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-[12.5px] leading-relaxed text-text-muted">
            One message per day at your chosen local hour: today's re-attempts, planner items,
            weekly fix on Mondays, one dynamic quote. No streaks, no shame. Toggle either channel
            off at any time.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ToggleRow
            label="Email digest"
            hint={`Sent to ${profile.email}`}
            checked={profile.digest_email_enabled}
            onChange={(v) => void saveEmailToggle(v)}
          />
          <ToggleRow
            label="WhatsApp digest"
            hint={
              profile.phone_e164
                ? `To ${profile.phone_e164}`
                : 'Add a phone number below'
            }
            checked={profile.digest_whatsapp_enabled}
            onChange={(v) => void saveWaToggle(v)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className="u-label mb-1 block">
              Phone (E.164)
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919000000000"
                autoComplete="tel"
              />
              <Button size="sm" variant="secondary" onClick={() => void savePhone()}>
                Save
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-text-faint">
              Country code first, no spaces. Used only for WhatsApp digest.
            </p>
          </div>
          <div>
            <label htmlFor="hour" className="u-label mb-1 block">
              Preferred local hour
            </label>
            <select
              id="hour"
              value={profile.digest_hour_local}
              onChange={(e) => void saveHour(Number(e.target.value))}
              className="block h-10 w-full rounded border border-border bg-bg-raised px-3 text-[13px] text-text focus:border-accent focus:shadow-[0_0_0_3px_theme(colors.accent.faint)] focus:outline-none"
            >
              {hourOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-text-faint">
              Timezone: <span className="u-num">{profile.timezone}</span>. Cron fires every 30 minutes
              past the hour; users at the matching local hour get the day's digest.
            </p>
          </div>
        </div>

        <details className="rounded border border-border/70 bg-bg-overlay/40 px-3 py-2 text-[12px] text-text-muted">
          <summary className="cursor-pointer font-medium text-text-muted">
            WhatsApp setup notes
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 leading-relaxed">
            <li>
              Create a Meta Business account and add a WhatsApp Business API app.
            </li>
            <li>
              Add + verify a phone number as the sender.
            </li>
            <li>
              Create a message template named <span className="u-num">daily_digest</span> with 4 body
              variables ({'{{1}}'} = greeting name, {'{{2}}'} = re-attempts count, {'{{3}}'} = planner
              count, {'{{4}}'} = fix or quote). Wait for Meta approval.
            </li>
            <li>
              Provide <span className="u-num">META_ACCESS_TOKEN</span> and{' '}
              <span className="u-num">META_PHONE_NUMBER_ID</span> to your Supabase project secrets.
            </li>
            <li>
              Every recipient must WhatsApp your business number at least once so the 24h window is
              open; templates are used to push after that.
            </li>
          </ol>
        </details>
      </CardBody>
    </Card>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded border border-border/70 bg-bg-overlay/30 px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-accent"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-text">{label}</p>
        <p className="mt-0.5 truncate text-[11px] text-text-faint">{hint}</p>
      </div>
    </label>
  );
}
