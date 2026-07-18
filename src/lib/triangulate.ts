// Helpers for F4.3 disagreement detection. Two responses "disagree" when the
// word-set Jaccard similarity of the aligned paragraphs is below a threshold
// (default 0.5 per BUILD.md §4.3). This is deliberately naive — we just want
// to draw the user's eye to divergent regions, not synthesize a conclusion.

export function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

export function jaccard(a: string, b: string): number {
  const A = tokenise(a);
  const B = tokenise(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return inter / union;
}

/**
 * Split a response into paragraph blocks (blank-line separated). Empty blocks
 * are dropped.
 */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export interface AlignedRow {
  index: number;
  cells: [string, string, string];
  /**
   * Pairwise Jaccard scores at [gm, go, mo] positions (groq-gemini,
   * groq-openrouter, gemini-openrouter). Nullable for missing cells.
   */
  scores: [number | null, number | null, number | null];
  disagreement: boolean;
}

/** Align three responses paragraph-by-paragraph. Shorter responses pad with ''. */
export function alignParagraphs(
  groq: string,
  gemini: string,
  openrouter: string,
  threshold = 0.5
): AlignedRow[] {
  const G = paragraphs(groq);
  const M = paragraphs(gemini);
  const O = paragraphs(openrouter);
  const n = Math.max(G.length, M.length, O.length);
  const rows: AlignedRow[] = [];
  for (let i = 0; i < n; i++) {
    const g = G[i] ?? '';
    const m = M[i] ?? '';
    const o = O[i] ?? '';
    const gm = g && m ? jaccard(g, m) : null;
    const go = g && o ? jaccard(g, o) : null;
    const mo = m && o ? jaccard(m, o) : null;
    const compared = [gm, go, mo].filter((s): s is number => s !== null);
    const disagreement =
      compared.length > 0 && compared.some((s) => s < threshold);
    rows.push({
      index: i,
      cells: [g, m, o],
      scores: [gm, go, mo],
      disagreement
    });
  }
  return rows;
}

/**
 * Summary of how much of the response set is contested. Feeds into the
 * `disagreement_noted` column so history shows a one-liner without re-reading
 * the whole triangulation.
 */
export function summariseDisagreement(rows: AlignedRow[]): {
  total: number;
  disagreeing: number;
  percent: number;
  minScore: number | null;
} {
  const total = rows.length;
  const disagreeing = rows.filter((r) => r.disagreement).length;
  const allScores = rows.flatMap((r) => r.scores).filter((s): s is number => s !== null);
  const minScore = allScores.length ? Math.min(...allScores) : null;
  return {
    total,
    disagreeing,
    percent: total === 0 ? 0 : Math.round((disagreeing / total) * 100),
    minScore
  };
}
