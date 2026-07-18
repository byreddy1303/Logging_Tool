// WhatsApp digest plumbing for the planner.
//
// CallMeBot flow:
//   1. User texts `I allow callmebot to send me messages` to +34 644 51 95 23
//   2. Bot replies with their API key
//   3. User pastes the key into the Planner settings card
//   4. We POST to https://api.callmebot.com/whatsapp.php?phone=…&text=…&apikey=…
//
// Daily send: a setInterval(60_000) tick checks whether the current time
// matches settings.time. On match — and only once per local day — we fire the
// WhatsApp POST. Browser push/local notifications are banned by BUILD.md §2.3,
// so the delivery channel is WhatsApp only. If the user wants a passive nudge,
// the WhatsApp message is the nudge.

import { quoteForDate } from '@/lib/motivational-quotes';
import {
  lastNotifiedOn,
  loadDayPlan,
  loadWhatsAppSettings,
  markNotifiedToday,
  summarize,
  type DayPlan,
  type WhatsAppSettings
} from '@/lib/planner-storage';
import { ENERGY_FORECASTS } from '@/lib/planner-constants';

const CALLMEBOT_URL = 'https://api.callmebot.com/whatsapp.php';

/* --------------------------- message building --------------------------- */

/** Human-readable planned duration. */
function formatMin(min: number): string {
  if (min <= 0) return '0m';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function energyLabel(v: DayPlan['mindset']['energyForecast']): string {
  return ENERGY_FORECASTS.find((e) => e.value === v)?.label ?? 'Medium';
}

/** The exact text we send over WhatsApp and show in the browser notification. */
export function buildDigestMessage(plan: DayPlan, dateISO: string): string {
  const s = summarize(plan);
  const lines: string[] = [];
  lines.push(quoteForDate(dateISO));
  lines.push('');
  lines.push(`*Plan for ${dateISO}*`);
  lines.push(`Day type: ${s.dayType ?? 'Full Study Day'}`);
  lines.push(`Energy: ${energyLabel(plan.mindset.energyForecast)}`);
  if (plan.sessions.length === 0) {
    lines.push('No sessions logged yet — open the planner and stack the day.');
  } else {
    lines.push('');
    lines.push('*Sessions*');
    for (const sess of plan.sessions) {
      const name =
        sess.subject === 'Custom...' && sess.customSubject
          ? sess.customSubject
          : sess.subject;
      const time = formatMin(sess.durationMin);
      lines.push(`• ${name} · ${time} · ${sess.mode} · ${sess.priority}`);
      if (sess.target) lines.push(`   → ${sess.target}`);
    }
  }
  lines.push('');
  lines.push(`Total planned: ${formatMin(s.totalMin)}`);
  if (plan.mindset.motivationNote) {
    lines.push('');
    lines.push(`*One thing today:* ${plan.mindset.motivationNote}`);
  }
  return lines.join('\n');
}

/* ---------------------------- CallMeBot API ---------------------------- */

export interface SendResult {
  ok: boolean;
  status: number;
  error?: string;
}

/** Fire the CallMeBot WhatsApp API. Returns the transport result so the caller
 *  can surface a toast. */
export async function sendWhatsApp(
  settings: WhatsAppSettings,
  text: string
): Promise<SendResult> {
  if (!settings.phoneE164 || !settings.apiKey) {
    return { ok: false, status: 0, error: 'Configure phone + API key first.' };
  }
  const url = new URL(CALLMEBOT_URL);
  url.searchParams.set('phone', settings.phoneE164);
  url.searchParams.set('text', text);
  url.searchParams.set('apikey', settings.apiKey);

  try {
    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: body.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message };
  }
}

/* ---------------------------- daily scheduler --------------------------- */

/** Return today's date in the user's local timezone as YYYY-MM-DD. */
function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Return current HH:MM in local time. */
function localHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

/** Start a per-minute tick that fires the daily notification when local time
 *  matches settings.time and we haven't already notified today. Returns a
 *  disposer. Safe to call more than once; each caller cleans up its own tick.
 *
 *  We intentionally use a plain setInterval instead of setTimeout-to-target
 *  because service worker background scheduling is not available for a PWA
 *  without opt-in; a tab-open + interval keeps the code simple and testable.
 */
export function startDailyTicker(): () => void {
  const tick = () => {
    const settings = loadWhatsAppSettings();
    if (!settings.enabled) return;
    const now = new Date();
    if (localHHMM(now) !== settings.time) return;
    const today = localISO(now);
    if (lastNotifiedOn() === today) return;

    const plan = loadDayPlan(today);
    if (!plan) return;
    const text = buildDigestMessage(plan, today);

    // WhatsApp is the only delivery channel. Fire-and-forget.
    void sendWhatsApp(settings, text);
    markNotifiedToday(today);
  };
  // First tick immediately in case the tab opens exactly at the target minute.
  tick();
  const handle = window.setInterval(tick, 60_000);
  return () => window.clearInterval(handle);
}
