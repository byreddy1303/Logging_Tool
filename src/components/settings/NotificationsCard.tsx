// Optional daily study digest. Email remains available; Telegram is the only
// proactive messaging integration. Telegram chat ids are bound by the bot
// webhook after a short-lived, user-generated connection link is opened.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Link2, RefreshCcw, Send, Unlink } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import type { TelegramSubscriptionRow, UserRow } from '@/types';

interface Props {
  profile: UserRow | null;
  sandbox: boolean;
}

const botUsername = String(import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? '')
  .trim()
  .replace(/^@/, '');

export default function NotificationsCard({ profile, sandbox }: Props) {
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const pushToast = useUiStore((s) => s.pushToast);
  const [telegram, setTelegram] = useState<TelegramSubscriptionRow | null>(null);
  const [loadingTelegram, setLoadingTelegram] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [awaitingConnection, setAwaitingConnection] = useState(false);
  const [sending, setSending] = useState(false);
  const hourOptions = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => ({
        value: hour,
        label: `${String(hour).padStart(2, '0')}:00`
      })),
    []
  );

  const loadTelegram = useCallback(async () => {
    if (!profile || sandbox || !supabaseConfigured) return;
    setLoadingTelegram(true);
    const { data, error } = await supabase
      .from('telegram_subscriptions')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();
    setLoadingTelegram(false);
    if (error) {
      pushToast(`Could not read Telegram status: ${error.message}`, 'neutral');
      return;
    }
    const next = (data as TelegramSubscriptionRow | null) ?? null;
    setTelegram(next);
    if (next?.connected_at) {
      setAwaitingConnection(false);
      setConnectUrl(null);
    }
  }, [profile, pushToast, sandbox]);

  useEffect(() => {
    void loadTelegram();
    const onFocus = () => void loadTelegram();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadTelegram]);

  useEffect(() => {
    if (!awaitingConnection) return;
    const poll = window.setInterval(() => void loadTelegram(), 3000);
    const stop = window.setTimeout(() => setAwaitingConnection(false), 120_000);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(stop);
    };
  }, [awaitingConnection, loadTelegram]);

  if (sandbox || !supabaseConfigured || !profile) return null;

  async function patchProfile(patch: Partial<UserRow>) {
    if (!profile) return false;
    const { error } = await supabase.from('users').update(patch).eq('id', profile.id);
    if (error) {
      pushToast(error.message, 'neutral');
      return false;
    }
    await refreshProfile();
    return true;
  }

  async function saveEmailToggle(value: boolean) {
    if (await patchProfile({ digest_email_enabled: value })) {
      pushToast(value ? 'Email digest on.' : 'Email digest off.', 'success');
    }
  }

  async function saveTelegramToggle(value: boolean) {
    const { error } = await supabase.rpc('set_telegram_digest_enabled', {
      wants_enabled: value
    });
    if (error) {
      pushToast(error.message, 'neutral');
      return;
    }
    await loadTelegram();
    pushToast(value ? 'Telegram digest on.' : 'Telegram digest paused.', 'success');
  }

  async function beginConnection() {
    if (!botUsername) {
      pushToast('Telegram bot setup is not finished yet.', 'neutral');
      return;
    }
    setConnecting(true);
    const { data, error } = await supabase.rpc('begin_telegram_connection');
    setConnecting(false);
    if (error) {
      pushToast(error.message, 'neutral');
      return;
    }
    const row = ((data as Array<{ token: string; expires_at: string }> | null) ?? [])[0];
    if (!row?.token) {
      pushToast('Could not create a Telegram connection link.', 'neutral');
      return;
    }
    setConnectUrl(`https://t.me/${botUsername}?start=${encodeURIComponent(row.token)}`);
    setAwaitingConnection(true);
  }

  async function disconnectTelegram() {
    const { error } = await supabase.rpc('disconnect_telegram');
    if (error) {
      pushToast(error.message, 'neutral');
      return;
    }
    setTelegram(null);
    setConnectUrl(null);
    setAwaitingConnection(false);
    pushToast('Telegram disconnected.', 'success');
  }

  async function saveHour(hour: number) {
    if (await patchProfile({ digest_hour_local: hour })) {
      pushToast(`Digest hour set to ${String(hour).padStart(2, '0')}:00.`, 'success');
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
    const report =
      ((data as {
        report?: Array<{
          email_ok?: boolean;
          telegram_ok?: boolean;
          email_err?: string;
          telegram_err?: string;
        }>;
      })?.report ?? [])[0];
    if (report?.email_ok || report?.telegram_ok) {
      pushToast(
        `Sent · email: ${report.email_ok ? 'ok' : 'off'}, Telegram: ${report.telegram_ok ? 'ok' : 'off'}`,
        'success'
      );
      await loadTelegram();
      return;
    }
    pushToast(
      `Nothing delivered. Email: ${report?.email_err ?? 'off'} · Telegram: ${report?.telegram_err ?? 'off'}`,
      'neutral'
    );
  }

  const connected = Boolean(telegram?.chat_id && telegram.connected_at);
  const telegramHint = connected
    ? telegram?.chat_username
      ? `Connected as @${telegram.chat_username}`
      : 'Private chat connected'
    : botUsername
      ? 'Connect your private Telegram chat'
      : 'Bot configuration pending';

  return (
    <Card id="digest">
      <CardHeader
        title="Daily study digest"
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
            One optional message at your chosen local hour with today&apos;s open planner items,
            due re-attempts, and Monday&apos;s weekly fix. It contains no streaks or engagement
            prompts, and either channel can be paused at any time.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ToggleRow
            label="Email digest"
            hint={`Sent to ${profile.email}`}
            checked={profile.digest_email_enabled}
            onChange={(value) => void saveEmailToggle(value)}
          />
          <ToggleRow
            label="Telegram digest"
            hint={telegramHint}
            checked={Boolean(telegram?.enabled)}
            disabled={!connected}
            onChange={(value) => void saveTelegramToggle(value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded border border-border/70 bg-bg-overlay/30 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[13px] font-medium text-text">Telegram connection</p>
                <p className="mt-0.5 text-[11px] text-text-faint">
                  {loadingTelegram ? 'Checking connection…' : telegramHint}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void loadTelegram()}
                disabled={loadingTelegram}
                aria-label="Refresh Telegram connection"
              >
                <RefreshCcw size={12} strokeWidth={1.75} />
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {!connected && !connectUrl && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void beginConnection()}
                  disabled={connecting || !botUsername}
                >
                  <Link2 size={12} strokeWidth={1.75} className="mr-1" />
                  {connecting ? 'Preparing…' : 'Connect Telegram'}
                </Button>
              )}
              {!connected && connectUrl && (
                <Button
                  size="sm"
                  onClick={() => window.open(connectUrl, '_blank', 'noopener,noreferrer')}
                >
                  <Send size={12} strokeWidth={1.75} className="mr-1" />
                  Open Telegram
                </Button>
              )}
              {connected && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void disconnectTelegram()}
                >
                  <Unlink size={12} strokeWidth={1.75} className="mr-1" />
                  Disconnect
                </Button>
              )}
            </div>

            {awaitingConnection && (
              <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                In Telegram, tap Start. This page will detect the connection automatically. The
                private link expires after 15 minutes.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="hour" className="u-label mb-1 block">
              Preferred local hour
            </label>
            <select
              id="hour"
              value={profile.digest_hour_local}
              onChange={(event) => void saveHour(Number(event.target.value))}
              className="block h-10 w-full rounded border border-border bg-bg-raised px-3 text-[13px] text-text focus:border-accent focus:shadow-[0_0_0_3px_theme(colors.accent.faint)] focus:outline-none"
            >
              {hourOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-text-faint">
              Timezone: <span className="u-num">{profile.timezone}</span>. Delivery runs once when
              this local hour begins.
            </p>
          </div>
        </div>

        {!botUsername && (
          <p className="rounded border border-warn/30 bg-warn/5 px-3 py-2 text-[11.5px] text-text-muted">
            The Telegram bot owner still needs to add its username and token to the deployment.
            Email delivery is unaffected.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled = false,
  onChange
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded border border-border/70 bg-bg-overlay/30 px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-accent disabled:cursor-not-allowed disabled:opacity-40"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-text">{label}</p>
        <p className="mt-0.5 truncate text-[11px] text-text-faint">{hint}</p>
      </div>
    </label>
  );
}
