import { describe, expect, it, vi } from 'vitest';
import {
  parseTelegramCommand,
  renderTelegramConnectionTest,
  renderTelegramDigest,
  sendTelegramMessage
} from '../../supabase/functions/_shared/telegram';
import { QUOTES, pickQuoteForDay } from '../../supabase/functions/_shared/quotes';

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
      dateLabel: 'TUESDAY · 21 JULY',
      quote: 'Your competition is still deciding. You already have the map.',
      quoteAttribution: 'AIR Journal',
      sessions: [
        {
          subject: 'Operating Systems',
          durationMin: 90,
          mode: 'PYQ Practice',
          target: 'Process synchronization questions'
        },
        {
          subject: 'DBMS',
          durationMin: 60,
          mode: 'Revision',
          target: 'Revise paging < traps'
        }
      ],
      reAttemptTotal: 3,
      subjectCounts: [
        { subject: 'Operating Systems', count: 2 },
        { subject: 'DBMS', count: 1 }
      ]
    });

    expect(message).toContain('<b>TUESDAY · 21 JULY</b>');
    expect(message).toContain('— AIR Journal');
    expect(message).toContain('<b>TODAY\'S PLAN · 2h 30m</b>');
    expect(message).toContain('<b>01 · Operating Systems</b>');
    expect(message).toContain('Revise paging &lt; traps');
    expect(message).toContain('<b>RE-ATTEMPTS · 3</b>');
    expect(message).toContain('2 sessions. Finish them cleanly.');
    expect(message.length).toBeLessThan(4096);
  });

  it('renders a useful connection test without needing a day plan', () => {
    const message = renderTelegramConnectionTest();

    expect(message).toContain('<b>AIR JOURNAL · CONNECTED</b>');
    expect(message).toContain('Telegram delivery is working.');
    expect(message).toContain('<b>No plan. No noise.</b>');
  });

  it('ships 60 unique, attributed quotes with stable daily selection', () => {
    expect(QUOTES).toHaveLength(60);
    expect(new Set(QUOTES.map((quote) => quote.text)).size).toBe(60);
    expect(QUOTES.every((quote) => quote.attribution.length > 0)).toBe(true);
    expect(pickQuoteForDay('2026-07-21', 'user-1')).toEqual(
      pickQuoteForDay('2026-07-21', 'user-1')
    );
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
