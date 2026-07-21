// Compatibility surface for the dashboard. The canonical presets and picker
// live in motivational-quotes so every in-app and notification surface agrees.
import {
  QUOTES,
  pickQuoteForDay,
  type QuotePreset
} from '@/lib/motivational-quotes';

export type OneLiner = QuotePreset;
export const ONE_LINERS = QUOTES;

export function pickOneLinerFor(dateISO: string, seed = ''): OneLiner {
  return pickQuoteForDay(dateISO, seed);
}
