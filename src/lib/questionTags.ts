/**
 * A question needs an explicit override only when both recognition cues are
 * missing. Either a reusable pattern or an exact trigger phrase is enough to
 * keep the normal fast logging path uninterrupted.
 */
export function needsMissingTagsConfirmation(
  pattern: string | null | undefined,
  trigger: string | null | undefined
): boolean {
  return !pattern?.trim() && !trigger?.trim();
}
