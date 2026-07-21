// Telegram webhook for the opt-in daily digest.
//
// Supported private-chat commands:
//   /start <short-lived token> — bind this Telegram chat to AIR Journal
//   /stop                      — pause the daily digest
//   /status                    — show the current connection state
//   /help                      — show the available commands

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { json } from '../_shared/cors.ts';
import { parseTelegramCommand, sendTelegramMessage } from '../_shared/telegram.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';

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

async function reply(chatId: number, text: string): Promise<void> {
  const result = await sendTelegramMessage({ token: BOT_TOKEN, chatId, text });
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
    await reply(chatId, 'Open AIR Journal Settings and use the private Connect Telegram link.');
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
      await reply(chatId, 'That connection link is invalid or expired. Generate a new one in AIR Journal Settings.');
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
      await reply(chatId, 'This Telegram account is already connected elsewhere, or the connection failed. Disconnect it there first.');
      return json({ ok: true });
    }

    await reply(
      chatId,
      '<b>AIR Journal connected.</b>\n\nYour optional daily study digest is on. Change its time or pause it from Settings. Use /stop here to pause immediately.'
    );
    return json({ ok: true });
  }

  const { data: subscription } = await admin
    .from('telegram_subscriptions')
    .select('user_id, enabled')
    .eq('chat_id', chatId)
    .maybeSingle();

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
    '<b>AIR Journal bot</b>\n/start — connect using the private Settings link\n/status — check delivery\n/stop — pause the daily digest'
  );
  return json({ ok: true });
});
