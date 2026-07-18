// One-time WhatsApp digest setup: phone, CallMeBot API key, notification
// time, browser-notification toggle. Everything writes straight to
// localStorage via planner-storage — no server round-trip.
import { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUiStore } from '@/stores/ui';
import {
  loadDayPlan,
  saveWhatsAppSettings,
  type WhatsAppSettings
} from '@/lib/planner-storage';
import { buildDigestMessage, sendWhatsApp } from '@/lib/planner-notify';

const E164_RE = /^\+[1-9]\d{7,14}$/;

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function WhatsAppSetup({
  settings,
  onChange
}: {
  settings: WhatsAppSettings;
  onChange: (next: WhatsAppSettings) => void;
}) {
  const pushToast = useUiStore((s) => s.pushToast);
  const [phone, setPhone] = useState(settings.phoneE164);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [time, setTime] = useState(settings.time);
  const [sending, setSending] = useState(false);

  function persist(patch: Partial<WhatsAppSettings>) {
    const next = { ...settings, ...patch };
    saveWhatsAppSettings(next);
    onChange(next);
  }

  function saveNumber() {
    const cleaned = phone.trim();
    if (cleaned && !E164_RE.test(cleaned)) {
      pushToast('Phone must be E.164, e.g. +919000000000.', 'neutral');
      return;
    }
    persist({ phoneE164: cleaned });
    pushToast('Phone saved.', 'success');
  }

  function saveKey() {
    const cleaned = apiKey.trim();
    persist({ apiKey: cleaned });
    pushToast('API key saved.', 'success');
  }

  function saveTime() {
    const cleaned = time.trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cleaned)) {
      pushToast('Time must be HH:MM (24h).', 'neutral');
      return;
    }
    persist({ time: cleaned });
    pushToast(`Digest scheduled for ${cleaned} local.`, 'success');
  }

  async function toggleEnabled(v: boolean) {
    if (v) {
      if (!phone.trim() || !apiKey.trim()) {
        pushToast('Add phone + API key before enabling.', 'neutral');
        return;
      }
    }
    persist({ enabled: v });
  }

  async function sendToday() {
    setSending(true);
    try {
      const plan = loadDayPlan(todayLocal());
      if (!plan || plan.sessions.length === 0) {
        pushToast('No plan for today yet. Add sessions first.', 'neutral');
        return;
      }
      const text = buildDigestMessage(plan, todayLocal());
      const res = await sendWhatsApp(settings, text);
      if (res.ok) {
        pushToast('Sent to WhatsApp.', 'success');
      } else {
        pushToast(res.error ?? `WhatsApp send failed (${res.status})`, 'neutral');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="WhatsApp digest"
        aside={
          <span className="text-[11px] text-text-faint">on-device schedule</span>
        }
      />
      <CardBody className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded border border-border/70 bg-bg-overlay/40 px-3 py-2 text-[12px] text-text-muted">
          <MessageCircle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" />
          <p>
            Uses the free{' '}
            <span className="u-num text-text">CallMeBot</span> WhatsApp API. One-time setup: text
            <span className="u-num text-text"> "I allow callmebot to send me messages"</span> to
            <span className="u-num text-text"> +34 644 51 95 23</span>. The bot replies with an API
            key — paste it below.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="wa-phone" className="u-label mb-1 block">
              Phone (E.164)
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="wa-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919000000000"
                autoComplete="tel"
              />
              <Button variant="secondary" size="sm" onClick={saveNumber}>
                Save
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-text-faint">
              Country code first, no spaces.
            </p>
          </div>
          <div>
            <label htmlFor="wa-key" className="u-label mb-1 block">
              CallMeBot API key
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="wa-key"
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="1234567"
                autoComplete="off"
              />
              <Button variant="secondary" size="sm" onClick={saveKey}>
                Save
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-text-faint">
              The number CallMeBot replies with.
            </p>
          </div>
          <div>
            <label htmlFor="wa-time" className="u-label mb-1 block">
              Daily send time (local)
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="wa-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
              <Button variant="secondary" size="sm" onClick={saveTime}>
                Save
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-text-faint">
              A tab must be open at the chosen time (PWA background sched not enabled).
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <ToggleRow
              label="Auto-send at daily time"
              hint="Requires phone + API key. Fires once per local day while a Planner tab is open."
              value={settings.enabled}
              onChange={(v) => void toggleEnabled(v)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button variant="primary" onClick={() => void sendToday()} disabled={sending}>
            <Send size={13} strokeWidth={1.75} className="mr-1" />
            {sending ? 'Sending…' : "Send today's plan now"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-start justify-between gap-3 rounded border border-border/70 bg-bg-overlay/30 px-3 py-2 text-left transition-colors hover:bg-bg-overlay"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-text">{label}</span>
        <span className="mt-0.5 block text-[11.5px] text-text-muted">{hint}</span>
      </span>
      <span
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          value ? 'bg-accent' : 'bg-bg-overlay'
        }`}
        aria-pressed={value}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  );
}
