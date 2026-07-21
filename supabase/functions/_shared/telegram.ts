export interface TelegramCommand {
  name: 'start' | 'stop' | 'status' | 'help';
  argument: string | null;
}
export interface TelegramPlanItem {
  title: string;
  subject: string | null;
  target_min: number | null;
}

export interface TelegramDigestInput {
  greeting: string;
  isoDate: string;
  reAttemptTotal: number;
  subjectCounts: Array<{ subject: string; count: number }>;
  openItems: TelegramPlanItem[];
  weeklyFix: string | null;
}

export interface TelegramSendResult {
  ok: boolean;
  id?: number;
  error?: string;
}

export function parseTelegramCommand(text: string | undefined): TelegramCommand | null {
  if (!text) return null;
  const match = text.trim().match(/^\/(start|stop|status|help)(?:@[A-Za-z0-9_]+)?(?:\s+([A-Za-z0-9_-]{1,64}))?\s*$/i);
  if (!match) return null;
  return {
    name: match[1].toLowerCase() as TelegramCommand['name'],
    argument: match[2] ?? null
  };
}

export function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderTelegramDigest(input: TelegramDigestInput): string {
  const lines: string[] = [
    `<b>AIR Journal · ${escapeTelegramHtml(input.isoDate)}</b>`,
    escapeTelegramHtml(input.greeting),
    ''
  ];

  lines.push('<b>Today\'s planner</b>');
  if (input.openItems.length === 0) {
    lines.push('No planner items are open today.');
  } else {
    for (const item of input.openItems.slice(0, 8)) {
      const detail = [item.subject, item.target_min ? `${item.target_min} min` : null]
        .filter(Boolean)
        .join(' · ');
      lines.push(`• ${escapeTelegramHtml(item.title)}${detail ? ` — ${escapeTelegramHtml(detail)}` : ''}`);
    }
    if (input.openItems.length > 8) {
      lines.push(`• ${input.openItems.length - 8} more in the planner`);
    }
  }

  lines.push('', `<b>Re-attempts due: ${input.reAttemptTotal}</b>`);
  if (input.reAttemptTotal === 0) {
    lines.push('Your re-attempt queue is clear.');
  } else {
    for (const row of input.subjectCounts.slice(0, 6)) {
      lines.push(`• ${escapeTelegramHtml(row.subject)} — ${row.count}`);
    }
  }

  if (input.weeklyFix) {
    lines.push('', '<b>This week\'s fix</b>', escapeTelegramHtml(input.weeklyFix));
  }

  return lines.join('\n').slice(0, 3900);
}

export async function sendTelegramMessage(args: {
  token: string;
  chatId: string | number;
  text: string;
  appUrl?: string;
  fetcher?: typeof fetch;
}): Promise<TelegramSendResult> {
  if (!args.token) return { ok: false, error: 'Telegram bot token missing' };

  const body: Record<string, unknown> = {
    chat_id: String(args.chatId),
    text: args.text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true }
  };

  if (args.appUrl) {
    body.reply_markup = {
      inline_keyboard: [[{ text: 'Open AIR Journal', url: args.appUrl }]]
    };
  }

  const request = args.fetcher ?? fetch;
  const response = await request(
    `https://api.telegram.org/bot${args.token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );

  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  };

  if (!response.ok || payload.ok !== true) {
    return {
      ok: false,
      error: `telegram ${response.status}: ${payload.description ?? 'send failed'}`
    };
  }

  return { ok: true, id: payload.result?.message_id };
}
