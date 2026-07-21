import { useAuth } from '@/hooks/useAuth';
import { pickQuoteForDay } from '@/lib/motivational-quotes';
import { todayISO } from '@/lib/utils';

export default function DailyQuote() {
  const { userId } = useAuth();
  const dateISO = todayISO();
  const quote = pickQuoteForDay(dateISO, userId ?? '');

  return (
    <blockquote
      className="mt-10 border-l-2 border-accent/40 py-0.5 pl-4"
      aria-label="Daily motivation"
    >
      <p className="u-label mb-1.5 text-accent">Daily line</p>
      <p className="font-display text-[14px] leading-relaxed text-text-muted">
        “{quote.text}”
      </p>
      <footer className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">
        — {quote.attribution}
      </footer>
    </blockquote>
  );
}
