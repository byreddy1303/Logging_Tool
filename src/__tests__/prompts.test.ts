import { describe, expect, it } from 'vitest';
import {
  formulaExtractImagePrompt,
  formulaExtractPrompt,
  parseFormulaExtraction,
  parseReflexResult,
  parseVariations,
  quickExplainPrompt,
  reflexScorePrompt,
  variationPrompt,
  weeklySynthesisPrompt
} from '@/lib/prompts';

describe('prompt templates', () => {
  it('quickExplain interpolates the three user fields verbatim', () => {
    const p = quickExplainPrompt({
      topic: 'DFA minimisation',
      currentUnderstanding: 'group by acceptance, refine',
      stuckPoint: 'partition when transitions loop back'
    });
    expect(p).toContain('TOPIC: DFA minimisation');
    expect(p).toContain("USER'S CURRENT UNDERSTANDING: group by acceptance, refine");
    expect(p).toContain("USER'S STUCK POINT: partition when transitions loop back");
    // Must keep the six section headings.
    for (const h of [
      '## 1. Formal definition',
      '## 2. All variations',
      '## 3. Common GATE question patterns',
      '## 4. Three worked examples',
      '## 5. Common mistakes',
      '## 6. Related concepts'
    ]) {
      expect(p).toContain(h);
    }
  });

  it('variation prompt is per BUILD.md §9.1', () => {
    const p = variationPrompt('Consider a byte-addressable memory of 4 KB.');
    expect(p).toContain('generate exactly 5 variations');
    expect(p).toContain('byte↔word addressable');
    expect(p).toContain('Consider a byte-addressable memory of 4 KB.');
  });

  it('formula prompt asks for JSON only', () => {
    const p = formulaExtractPrompt('Cache hit rate = 1 - miss rate');
    expect(p).toContain('output valid JSON only');
    expect(p).toContain('Cache hit rate = 1 - miss rate');
  });

  it('reflex prompt is single-word contract', () => {
    const p = reflexScorePrompt({
      phrase: 'longest common subsequence',
      canonical: 'DP',
      userAnswer: 'dynamic programming'
    });
    expect(p).toContain('ONE WORD only');
    expect(p).toContain('MATCH');
    expect(p).toContain('longest common subsequence');
  });

  it('weekly synthesis prompt binds user conclusions', () => {
    const p = weeklySynthesisPrompt({
      weekStart: '2026-07-13',
      rootCauseSummary: 'formula gaps',
      weakestConcept: 'set theory',
      thisWeeksFix: 'daily flash cards',
      dataJson: '{"RBG":4}'
    });
    expect(p).toContain('week of 2026-07-13');
    expect(p).toContain('formula gaps');
    expect(p).toContain('{"RBG":4}');
    expect(p).toContain('## Agreement / disagreement');
  });
});

describe('response parsers', () => {
  it('parseReflexResult handles capitalisation and trailing text', () => {
    expect(parseReflexResult('MATCH')).toBe('MATCH');
    expect(parseReflexResult('  match \n')).toBe('MATCH');
    expect(parseReflexResult('Match — good')).toBe('MATCH');
    expect(parseReflexResult('MISS')).toBe('MISS');
    expect(parseReflexResult('idk')).toBeNull();
  });

  it('parseFormulaExtraction strips code fences and filters malformed rows', () => {
    const raw =
      '```json\n[{"name":"Cache","expression":"h=1-m","when_to_use":"perf"},{"name":"x"}]\n```';
    const out = parseFormulaExtraction(raw);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ name: 'Cache', expression: 'h=1-m', when_to_use: 'perf' });
  });

  it('parseFormulaExtraction returns [] on garbage', () => {
    expect(parseFormulaExtraction('sorry no formulas')).toEqual([]);
  });

  it('parseFormulaExtraction accepts plain array without fences', () => {
    const raw = '[{"name":"Sum","expression":"\\\\sum_{i=1}^{n} i = n(n+1)/2","when_to_use":"arithmetic series"}]';
    const out = parseFormulaExtraction(raw);
    expect(out).toHaveLength(1);
    expect(out[0].expression).toBe('\\sum_{i=1}^{n} i = n(n+1)/2');
  });

  it('parseFormulaExtraction accepts a single object (not array)', () => {
    const raw = '{"name":"BFS","expression":"O(V+E)","when_to_use":"unweighted shortest path"}';
    const out = parseFormulaExtraction(raw);
    expect(out).toEqual([
      { name: 'BFS', expression: 'O(V+E)', when_to_use: 'unweighted shortest path' }
    ]);
  });

  it('parseFormulaExtraction accepts synonym keys (whenToUse / formula)', () => {
    const raw = '[{"title":"DFS","formula":"O(V+E)","whenToUse":"topological sort"}]';
    const out = parseFormulaExtraction(raw);
    expect(out).toEqual([
      { name: 'DFS', expression: 'O(V+E)', when_to_use: 'topological sort' }
    ]);
  });

  it('parseFormulaExtraction ignores prose preamble', () => {
    const raw = `Here is the JSON:
\`\`\`json
[{"name":"n choose k","expression":"\\\\binom{n}{k}","when_to_use":"combinations"}]
\`\`\``;
    const out = parseFormulaExtraction(raw);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('n choose k');
    expect(out[0].expression).toBe('\\binom{n}{k}');
  });

  it('parseFormulaExtraction ignores stray trailing text', () => {
    const raw = '[{"name":"Master theorem","expression":"T(n) = aT(n/b) + f(n)","when_to_use":"divide and conquer recurrences"}] — hope that helps!';
    const out = parseFormulaExtraction(raw);
    expect(out).toHaveLength(1);
    expect(out[0].expression).toBe('T(n) = aT(n/b) + f(n)');
  });

  it('parseFormulaExtraction preserves LaTeX subscripts/superscripts verbatim', () => {
    const raw = JSON.stringify([
      {
        name: 'Euler',
        expression: 'e^{i\\pi} + 1 = 0',
        when_to_use: 'complex analysis identity'
      },
      {
        name: 'Cauchy-Schwarz',
        expression: '\\left(\\sum_{i=1}^{n} a_i b_i\\right)^2 \\leq \\left(\\sum a_i^2\\right)\\left(\\sum b_i^2\\right)',
        when_to_use: 'bounds on inner products'
      }
    ]);
    const out = parseFormulaExtraction(raw);
    expect(out).toHaveLength(2);
    expect(out[0].expression).toBe('e^{i\\pi} + 1 = 0');
    expect(out[1].expression).toContain('\\sum_{i=1}^{n}');
    expect(out[1].expression).toContain('\\leq');
  });

  it('parseFormulaExtraction returns [] for an explicit empty response', () => {
    expect(parseFormulaExtraction('[]')).toEqual([]);
    expect(parseFormulaExtraction('```json\n[]\n```')).toEqual([]);
  });

  it('parseFormulaExtraction drops rows missing any field but keeps the good ones', () => {
    const raw = JSON.stringify([
      { name: 'ok', expression: '1+1=2', when_to_use: 'trivial' },
      { name: 'no expr', when_to_use: 'x' },
      { name: '', expression: 'x=y', when_to_use: 'x' },
      null,
      42,
      { name: 'ok2', expression: 'a=b', when_to_use: 'y' }
    ]);
    const out = parseFormulaExtraction(raw);
    expect(out.map((r) => r.name)).toEqual(['ok', 'ok2']);
  });

  it('parseFormulaExtraction trims surrounding whitespace on each field', () => {
    const raw = JSON.stringify([
      { name: '  Foo  ', expression: '  x = y  ', when_to_use: '  bar  ' }
    ]);
    const out = parseFormulaExtraction(raw);
    expect(out[0]).toEqual({ name: 'Foo', expression: 'x = y', when_to_use: 'bar' });
  });

  it('parseFormulaExtraction handles empty / whitespace / null input', () => {
    expect(parseFormulaExtraction('')).toEqual([]);
    expect(parseFormulaExtraction('   \n  \t  ')).toEqual([]);
    expect(parseFormulaExtraction(null as unknown as string)).toEqual([]);
    expect(parseFormulaExtraction(undefined as unknown as string)).toEqual([]);
  });

  it('parseFormulaExtraction handles a JSON object embedded in surrounding prose', () => {
    const raw = 'Great question! Here you go: {"name":"Pigeonhole","expression":"\\\\lceil n/k \\\\rceil","when_to_use":"one bucket has at least this many"} that is all.';
    const out = parseFormulaExtraction(raw);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Pigeonhole');
  });

  it('parseFormulaExtraction rejects malformed JSON without throwing', () => {
    expect(() => parseFormulaExtraction('[{name: bad')).not.toThrow();
    expect(parseFormulaExtraction('[{name: bad')).toEqual([]);
  });

  it('parseFormulaExtraction handles a large realistic Gemini-style response', () => {
    const raw = `\`\`\`json
[
  {
    "name": "Master theorem case 1",
    "expression": "T(n) = aT(n/b) + O(n^c) \\\\text{ where } c < \\\\log_b a \\\\Rightarrow T(n) = \\\\Theta(n^{\\\\log_b a})",
    "when_to_use": "Divide-and-conquer recurrences where the work-per-level shrinks"
  },
  {
    "name": "Master theorem case 2",
    "expression": "T(n) = aT(n/b) + O(n^c \\\\log^k n) \\\\text{ where } c = \\\\log_b a \\\\Rightarrow T(n) = \\\\Theta(n^c \\\\log^{k+1} n)",
    "when_to_use": "Divide-and-conquer where each level does the same total work"
  },
  {
    "name": "Master theorem case 3",
    "expression": "T(n) = aT(n/b) + O(n^c) \\\\text{ where } c > \\\\log_b a \\\\Rightarrow T(n) = \\\\Theta(n^c)",
    "when_to_use": "Divide-and-conquer where the combine step dominates"
  }
]
\`\`\``;
    const out = parseFormulaExtraction(raw);
    expect(out).toHaveLength(3);
    // Each expression contains the LaTeX \Theta and structure was preserved.
    for (const row of out) {
      expect(row.expression).toContain('\\Theta');
      expect(row.expression).toContain('\\text');
      expect(row.name).toMatch(/Master theorem/);
    }
  });
});

describe('formulaExtractImagePrompt', () => {
  it('is a stable non-empty prompt with strict JSON contract', () => {
    const p = formulaExtractImagePrompt();
    expect(p).toContain('STRICT JSON');
    expect(p).toContain('LaTeX');
    expect(p).toContain('\\sum');
    expect(p).toContain('when_to_use');
  });

  it('parseVariations captures numbered blocks and caps at 5', () => {
    const raw = `1. First variation. Long text.
2. Second one
   spans two lines.
3. Third
4. Fourth
5. Fifth
6. Sixth — should be dropped`;
    const out = parseVariations(raw);
    expect(out).toHaveLength(5);
    expect(out[0]).toBe('First variation. Long text.');
    expect(out[1]).toBe('Second one\n   spans two lines.');
    expect(out[4]).toBe('Fifth');
  });

  it('parseVariations accepts "1)" style numbering', () => {
    const out = parseVariations('1) alpha\n2) beta');
    expect(out).toEqual(['alpha', 'beta']);
  });
});
