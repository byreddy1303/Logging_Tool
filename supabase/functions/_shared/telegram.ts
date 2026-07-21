export interface TelegramCommand {
  name: 'start' | 'stop' | 'status' | 'help';
  argument: string | null;
}
export interface TelegramStudySession {
  subject: string;
  customSubject?: string;
  durationMin: number;
  mode: string;
  target: string;
}

export interface TelegramDigestInput {
  dateLabel: string;
  quote: string;
  sessions: TelegramStudySession[];
  reAttemptTotal: number;
  subjectCounts: Array<{ subject: string; count: number }>;
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

function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function renderTelegramDigest(input: TelegramDigestInput): string {
  const sessions = input.sessions.slice(0, 6);
  const totalMinutes = input.sessions.reduce(
    (sum, session) => sum + Math.max(0, session.durationMin || 0),
    0
  );
  const lines: string[] = [
    '<b>AIR JOURNAL</b>',
    `<b>${escapeTelegramHtml(input.dateLabel)}</b>`,
    '',
    `<i>“${escapeTelegramHtml(input.quote)}”</i>`,
    '',
    `<b>TODAY'S PLAN · ${formatDuration(totalMinutes)}</b>`,
    ''
  ];

  sessions.forEach((session, index) => {
    const subject =
      session.subject === 'Custom...' && session.customSubject
        ? session.customSubject
        : session.subject;
    lines.push(
      `<b>${String(index + 1).padStart(2, '0')} · ${escapeTelegramHtml(subject)}</b>`,
      `${formatDuration(session.durationMin)} · ${escapeTelegramHtml(session.mode)}`
    );
    if (session.target.trim()) lines.push(escapeTelegramHtml(session.target.trim()));
    lines.push('');
  });

  if (input.sessions.length > sessions.length) {
    lines.push(`${input.sessions.length - sessions.length} more sessions in AIR Journal`, '');
  }

  if (input.reAttemptTotal === 0) {
    lines.push('<b>RE-ATTEMPTS · CLEAR</b>');
  } else {
    lines.push(`<b>RE-ATTEMPTS · ${input.reAttemptTotal}</b>`);
    for (const row of input.subjectCounts.slice(0, 4)) {
      lines.push(`${escapeTelegramHtml(row.subject)} · ${row.count}`);
    }
  }

  const sessionWord = input.sessions.length === 1 ? 'session' : 'sessions';
  lines.push('', `${input.sessions.length} ${sessionWord}. Finish them cleanly.`);

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
