import { describe, expect, it } from 'vitest';
import {
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
