import { describe, expect, it, vi } from 'vitest';
import {
  parseTelegramCommand,
  renderTelegramDigest,
  sendTelegramMessage
} from '../../supabase/functions/_shared/telegram';

describe('Telegram daily digest', () => {
  it('parses supported bot commands without accepting arbitrary text', () => {
    expect(parseTelegramCommand('/start 3dbb0b09-d4ca-4dc4-8e93-f503950b7781')).toEqual({
      name: 'start',
      argument: '3dbb0b09-d4ca-4dc4-8e93-f503950b7781'
    });
    expect(parseTelegramCommand('/status@air_journal_bot')).toEqual({
      name: 'status',
      argument: null
    });
    expect(parseTelegramCommand('send me a digest')).toBeNull();
  });

  it('renders a compact, escaped study-only message', () => {
    const message = renderTelegramDigest({
      greeting: 'Good morning, Kalyan.',
      isoDate: '2026-07-21',
      reAttemptTotal: 3,
      subjectCounts: [
        { subject: 'Operating Systems', count: 2 },
        { subject: 'DBMS', count: 1 }
      ],
      openItems: [
        {
          title: 'Revise paging < traps',
          subject: 'Operating Systems',
          target_min: 45
        }
      ],
      weeklyFix: 'Read the exact quantifier before solving.'
    });

    expect(message).toContain('<b>Today\'s planner</b>');
    expect(message).toContain('Revise paging &lt; traps');
    expect(message).toContain('<b>Re-attempts due: 3</b>');
    expect(message).toContain('<b>This week\'s fix</b>');
    expect(message.length).toBeLessThan(4096);
  });

  it('sends HTML with a dashboard button through the Telegram Bot API', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const result = await sendTelegramMessage({
      token: 'test-token',
      chatId: 123456,
      text: '<b>AIR Journal</b>',
      appUrl: 'https://air-journal-omega.vercel.app',
      fetcher
    });

    expect(result).toEqual({ ok: true, id: 42 });
    expect(fetcher).toHaveBeenCalledOnce();
    const [, init] = fetcher.mock.calls[0];
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      chat_id: '123456',
      parse_mode: 'HTML',
      text: '<b>AIR Journal</b>'
    });
  });
});
