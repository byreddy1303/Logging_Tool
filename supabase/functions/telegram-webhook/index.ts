// Telegram webhook for the opt-in daily digest.
//
// Supported private-chat commands:
//   /start <short-lived token> — bind this Telegram chat to AIR Journal
//   /stop                      — pause the daily digest
//   /status                    — show the current connection state
//   /timetable                 — show this user's current-week study plan
//   /tomorrow                  — show this user's next-day study plan
//   /help                      — show the available commands

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { json } from '../_shared/cors.ts';
import {
  airJournalUrl,
  isoDateForTimezone,
  parseTelegramCommand,
  parseTelegramStudySessions,
  renderTelegramTimetable,
  renderTelegramTomorrowPlan,
  sendTelegramMessage,
  tomorrowIsoDateForTimezone,
  weekIsoDatesForTimezone
} from '../_shared/telegram.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';
const APP_URL = Deno.env.get('VITE_APP_URL') ?? 'https://air-journal-omega.vercel.app';

const admin = createClient(SUPABASE_URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false }
});
interface TelegramUpdate {
  message?: {
    text?: string;
    chat: {
      id: number;
      type: string;
      username?: string;
    };
  };
}

interface StoredPlannerDay {
  plan_date: string;
  sessions: unknown;
}

let commandMenuReady = false;
let commandMenuPromise: Promise<void> | null = null;

async function ensureTelegramCommandMenu(): Promise<void> {
  if (commandMenuReady) return;
  if (commandMenuPromise) return commandMenuPromise;
  commandMenuPromise = (async () => {
    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: [
            { command: 'tomorrow', description: "Show tomorrow's study plan" },
            { command: 'timetable', description: "Show this week's study timetable" },
            { command: 'status', description: 'Check Telegram delivery status' },
            { command: 'stop', description: 'Pause the daily digest' },
            { command: 'help', description: 'Show available commands' }
          ]
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean };
      if (!response.ok || payload.ok !== true) {
        console.error('Telegram command menu registration failed:', response.status);
        return;
      }
      commandMenuReady = true;
    } catch (error) {
      console.error('Telegram command menu registration failed:', error);
    } finally {
      commandMenuPromise = null;
    }
  })();
  return commandMenuPromise;
}

async function reply(chatId: number, text: string, appRoute?: string): Promise<void> {
  const result = await sendTelegramMessage({
    token: BOT_TOKEN,
    chatId,
    text,
    appUrl: appRoute ? airJournalUrl(APP_URL, appRoute) : undefined
  });
  if (!result.ok) console.error('Telegram reply failed:', result.error);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);

  const presentedSecret = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!WEBHOOK_SECRET || presentedSecret !== WEBHOOK_SECRET) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  if (!BOT_TOKEN || !SUPABASE_URL || !SERVICE) {
    console.error('Telegram webhook is missing required secrets.');
    return json({ ok: false, error: 'server not configured' }, 503);
  }

  await ensureTelegramCommandMenu();

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return json({ ok: true });
  }

  const message = update.message;
  if (!message || message.chat.type !== 'private') return json({ ok: true });

  const chatId = message.chat.id;
  const command = parseTelegramCommand(message.text);

  if (!command) {
    await reply(
      chatId,
      'Use /tomorrow for the next day, /timetable for this week, or /help for every command.'
    );
    return json({ ok: true });
  }

  if (command.name === 'start') {
    if (!command.argument) {
      await reply(chatId, 'This bot needs a private connection link from AIR Journal Settings.');
      return json({ ok: true });
    }

    const { data: subscription, error: lookupError } = await admin
      .from('telegram_subscriptions')
      .select('user_id, connect_token_expires_at')
      .eq('connect_token', command.argument)
      .maybeSingle();

    const expiry = subscription?.connect_token_expires_at
      ? new Date(subscription.connect_token_expires_at)
      : null;
    if (lookupError || !subscription || !expiry || expiry.getTime() <= Date.now()) {
      await reply(
        chatId,
        'That connection link is invalid or expired. Generate a new one in AIR Journal Settings.'
      );
      return json({ ok: true });
    }

    const { error: updateError } = await admin
      .from('telegram_subscriptions')
      .update({
        chat_id: chatId,
        chat_username: message.chat.username ?? null,
        enabled: true,
        connected_at: new Date().toISOString(),
        connect_token: null,
        connect_token_expires_at: null,
        last_digest_sent_on: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', subscription.user_id);

    if (updateError) {
      console.error('Telegram connection failed:', updateError.message);
      await reply(
        chatId,
        'This Telegram account is already connected elsewhere, or the connection failed. Disconnect it there first.'
      );
      return json({ ok: true });
    }

    await reply(
      chatId,
      '<b>AIR Journal connected.</b>\n\nYour optional daily study digest is on. Change its time or pause it from Settings. Use /tomorrow for the next day or /timetable for the week.'
    );
    return json({ ok: true });
  }

  const { data: subscription } = await admin
    .from('telegram_subscriptions')
    .select('user_id, enabled')
    .eq('chat_id', chatId)
    .maybeSingle();

  if (command.name === 'timetable' || command.name === 'tomorrow') {
    if (!subscription) {
      await reply(
        chatId,
        `Connect this Telegram account from AIR Journal Settings before using /${command.name}.`
      );
      return json({ ok: true });
    }

    const { data: user, error: userError } = await admin
      .from('users')
      .select('timezone')
      .eq('id', subscription.user_id)
      .maybeSingle();
    if (userError || !user) {
      console.error('Telegram planner profile load failed:', userError?.message);
      await reply(chatId, 'I could not load your planner right now. Try again in a moment.');
      return json({ ok: true });
    }

    const timezone =
      typeof user.timezone === 'string' && user.timezone ? user.timezone : 'Asia/Kolkata';
    const now = new Date();

    if (command.name === 'tomorrow') {
      const tomorrowDate = tomorrowIsoDateForTimezone(now, timezone);
      const { data: storedPlan, error: planError } = await admin
        .from('planner_day_plans')
        .select('plan_date, sessions')
        .eq('user_id', subscription.user_id)
        .eq('plan_date', tomorrowDate)
        .maybeSingle();
      if (planError) {
        console.error(
          'Telegram tomorrow plan load failed:',
          subscription.user_id,
          planError.message
        );
        await reply(chatId, "I could not load tomorrow's plan right now. Try again in a moment.");
        return json({ ok: true });
      }

      const tomorrowPlan = renderTelegramTomorrowPlan({
        isoDate: tomorrowDate,
        sessions: parseTelegramStudySessions((storedPlan as StoredPlannerDay | null)?.sessions)
      });
      await reply(chatId, tomorrowPlan, `/planner?date=${tomorrowDate}`);
      return json({ ok: true });
    }

    const weekDates = weekIsoDatesForTimezone(now, timezone);
    const { data: storedPlans, error: plansError } = await admin
      .from('planner_day_plans')
      .select('plan_date, sessions')
      .eq('user_id', subscription.user_id)
      .gte('plan_date', weekDates[0])
      .lte('plan_date', weekDates[6])
      .order('plan_date', { ascending: true });
    if (plansError) {
      console.error('Telegram timetable load failed:', subscription.user_id, plansError.message);
      await reply(chatId, 'I could not load your timetable right now. Try again in a moment.');
      return json({ ok: true });
    }

    const sessionsByDate = new Map(
      ((storedPlans as StoredPlannerDay[]) ?? []).map((plan) => [
        plan.plan_date,
        parseTelegramStudySessions(plan.sessions)
      ])
    );
    const timetable = renderTelegramTimetable({
      todayIsoDate: isoDateForTimezone(now, timezone),
      days: weekDates.map((isoDate) => ({
        isoDate,
        sessions: sessionsByDate.get(isoDate) ?? []
      }))
    });
    await reply(chatId, timetable, '/planner');
    return json({ ok: true });
  }

  if (command.name === 'stop') {
    if (subscription) {
      await admin
        .from('telegram_subscriptions')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('user_id', subscription.user_id);
    }
    await reply(chatId, 'Daily digest paused. You can turn it back on in AIR Journal Settings.');
    return json({ ok: true });
  }

  if (command.name === 'status') {
    const status = subscription
      ? subscription.enabled
        ? 'connected and enabled'
        : 'connected but paused'
      : 'not connected';
    await reply(chatId, `<b>AIR Journal status:</b> ${status}.`);
    return json({ ok: true });
  }

  await reply(
    chatId,
    "<b>AIR Journal bot</b>\n/tomorrow — show tomorrow's study plan\n/timetable — show this week's study timetable\n/status — check delivery\n/stop — pause the daily digest\n/start — connect using the private Settings link"
  );
  return json({ ok: true });
});
