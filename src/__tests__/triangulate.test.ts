import { describe, expect, it } from 'vitest';
import {
  alignParagraphs,
  jaccard,
  paragraphs,
  summariseDisagreement,
  tokenise
} from '@/lib/triangulate';

describe('tokenise', () => {
  it('lowercases and drops short tokens', () => {
    const s = tokenise('The Big-Oh notation is O(n log n).');
    expect(s.has('big')).toBe(true);
    expect(s.has('notation')).toBe(true);
    expect(s.has('is')).toBe(false); // < 3 chars
    expect(s.has('the')).toBe(true); // exactly 3 chars? "the" is length 3, filter is > 2 so yes
  });

  it('strips punctuation and drops tokens < 3 chars', () => {
    const s = tokenise('cache-line 64 bytes.');
    // '64' is length 2, filtered by the >2 rule.
    expect(Array.from(s).sort()).toEqual(['bytes', 'cache', 'line']);
  });
});

describe('jaccard', () => {
  it('identical strings → 1', () => {
    expect(jaccard('finite automaton', 'finite automaton')).toBe(1);
  });

  it('disjoint strings → 0', () => {
    expect(jaccard('finite automaton', 'context grammar')).toBe(0);
  });

  it('partial overlap 0..1 monotone', () => {
    const j = jaccard(
      'DFA minimisation Hopcroft algorithm partition',
      'DFA minimisation table-filling algorithm'
    );
    expect(j).toBeGreaterThan(0);
    expect(j).toBeLessThan(1);
  });

  it('both empty → 1 (avoid div-by-zero)', () => {
    expect(jaccard('', '')).toBe(1);
  });

  it('one empty → 0', () => {
    expect(jaccard('hello world', '')).toBe(0);
  });
});

describe('paragraphs', () => {
  it('splits on blank lines and trims', () => {
    const p = paragraphs('  first  \n\nsecond\nline\n\n\nthird');
    expect(p).toEqual(['first', 'second\nline', 'third']);
  });
  it('drops empty', () => {
    expect(paragraphs('\n\n\n')).toEqual([]);
  });
});

describe('alignParagraphs', () => {
  it('same length responses align 1-to-1', () => {
    const a = 'para one\n\npara two';
    const b = 'para one\n\ndifferent totally';
    const c = 'para one\n\npara two exactly';
    const rows = alignParagraphs(a, b, c);
    expect(rows).toHaveLength(2);
    expect(rows[0].cells[0]).toBe('para one');
    // first row: all identical → high similarity → no disagreement
    expect(rows[0].disagreement).toBe(false);
    // second row: b diverges → disagreement
    expect(rows[1].disagreement).toBe(true);
  });

  it('pads shorter responses with empty string', () => {
    const rows = alignParagraphs('a\n\nb\n\nc', 'a', 'a\n\nb');
    expect(rows).toHaveLength(3);
    expect(rows[2].cells).toEqual(['c', '', '']);
  });

  it('missing cells produce null scores instead of 0', () => {
    const rows = alignParagraphs('a b c d', '', 'a b c d');
    expect(rows[0].scores[0]).toBeNull(); // gm empty
    expect(rows[0].scores[1]).toBeCloseTo(1, 3); // go identical
    expect(rows[0].scores[2]).toBeNull(); // mo empty
  });

  it('respects threshold override', () => {
    // Partial overlap: 3 shared tokens (regular, language, accept), 2 diverge.
    const a = 'DFA regular language accept string';
    const b = 'NFA regular language accept string';
    const c = 'DFA regular language accept string';
    const strict = alignParagraphs(a, b, c, 0.95);
    const loose = alignParagraphs(a, b, c, 0.4);
    // Jaccard between a and b is ~0.66 (4 shared / 6 union).
    expect(strict[0].disagreement).toBe(true);
    expect(loose[0].disagreement).toBe(false);
  });
});

describe('summariseDisagreement', () => {
  it('counts rows and computes percent + min score', () => {
    const rows = alignParagraphs(
      'x y z\n\np q r',
      'x y z\n\nsomething else entirely',
      'x y z\n\np q r'
    );
    const s = summariseDisagreement(rows);
    expect(s.total).toBe(2);
    expect(s.disagreeing).toBe(1);
    expect(s.percent).toBe(50);
    expect(s.minScore).not.toBeNull();
  });
});
