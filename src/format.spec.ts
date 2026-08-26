import { describe, expect, it } from 'vitest';
import {
  asNumber,
  asVector,
  formatLoose,
  formatMatrix,
  formatNumber,
  formatSampling,
  formatValue,
  slugify,
  sortIgnoreCase
} from './format';

describe('formatNumber', () => {
  it('passes integers through', () => {
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(-7)).toBe('-7');
    expect(formatNumber(0)).toBe('0');
  });

  it('trims float noise to 4 decimal places', () => {
    expect(formatNumber(1.23456789)).toBe('1.2346');
    expect(formatNumber(0.30000000000000004)).toBe('0.3');
    expect(formatNumber(2.00001)).toBe('2');
    expect(formatNumber(-1.23456)).toBe('-1.2346');
  });
});

describe('formatValue', () => {
  it('renders null/undefined as an em dash', () => {
    expect(formatValue(null)).toBe('—');
    expect(formatValue(undefined)).toBe('—');
  });

  it('renders booleans, numbers, and arrays', () => {
    expect(formatValue(true)).toBe('true');
    expect(formatValue(1.5)).toBe('1.5');
    expect(formatValue([1, 2.25, 3])).toBe('[1, 2.25, 3]');
  });
});

describe('formatMatrix', () => {
  it('transposes a flat column-major array into row-major rows', () => {
    // Columns are [1,2] and [3,4] — conventional reading is rows [1,3], [2,4]
    const rows = formatMatrix([1, 2, 3, 4], 2)
      .split('\n')
      .map((row) => row.trim().split(/\s+/));
    expect(rows).toEqual([
      ['1', '3'],
      ['2', '4']
    ]);
  });

  it('handles a 3x3 identity', () => {
    const rows = formatMatrix([1, 0, 0, 0, 1, 0, 0, 0, 1], 3)
      .split('\n')
      .map((row) => row.trim().split(/\s+/));
    expect(rows).toEqual([
      ['1', '0', '0'],
      ['0', '1', '0'],
      ['0', '0', '1']
    ]);
  });
});

describe('formatSampling', () => {
  it('returns null when nothing is known', () => {
    expect(formatSampling({})).toBeNull();
    expect(formatSampling({ filtering: null, wrapX: null, wrapY: null })).toBeNull();
  });

  it('renders filtering alone', () => {
    expect(formatSampling({ filtering: 'Pixel' })).toBe('Pixel');
  });

  it('collapses equal wrap modes and joins with a middle dot', () => {
    expect(formatSampling({ filtering: 'Blended', wrapX: 'Clamp', wrapY: 'Clamp' })).toBe('Blended · Clamp');
  });

  it('shows both wrap modes when they differ, with ? for the unknown side', () => {
    expect(formatSampling({ wrapX: 'Repeat', wrapY: 'Mirror' })).toBe('Repeat×Mirror');
    expect(formatSampling({ wrapX: 'Repeat' })).toBe('Repeat×?');
  });
});

describe('asNumber / asVector', () => {
  it('coerces non-numbers to the fallback', () => {
    expect(asNumber(5)).toBe(5);
    expect(asNumber('5')).toBe(0);
    expect(asNumber(undefined, 9)).toBe(9);
  });

  it('extracts numeric x/y from unknown vector-ish values', () => {
    expect(asVector({ x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
    expect(asVector(null)).toEqual({ x: 0, y: 0 });
    expect(asVector({ x: 'nope' })).toEqual({ x: 0, y: 0 });
  });
});

describe('formatLoose', () => {
  it('renders nullish as an em dash and Infinity sentinels as symbols', () => {
    expect(formatLoose(null)).toBe('—');
    expect(formatLoose('Infinity')).toBe('∞');
    expect(formatLoose('-Infinity')).toBe('-∞');
  });

  it('renders vectors as coordinate pairs', () => {
    expect(formatLoose({ x: 1.5, y: -2 })).toBe('(1.5, -2)');
  });

  it('renders arrays recursively', () => {
    expect(formatLoose([1, { x: 0, y: 0 }])).toBe('[1, (0, 0)]');
  });

  it('falls back to JSON for other objects', () => {
    expect(formatLoose({ a: 1 })).toBe('{"a":1}');
  });
});

describe('sortIgnoreCase', () => {
  it('sorts case-insensitively', () => {
    expect(sortIgnoreCase(['banana', 'Apple', 'cherry'])).toEqual(['Apple', 'banana', 'cherry']);
  });

  it('puts lowercase before uppercase on otherwise-equal strings', () => {
    expect(sortIgnoreCase(['Apple', 'apple'])).toEqual(['apple', 'Apple']);
  });

  it('does not mutate the input', () => {
    const input = ['b', 'a'];
    sortIgnoreCase(input);
    expect(input).toEqual(['b', 'a']);
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('  spaced  out  ')).toBe('spaced-out');
  });

  it('strips non-word characters and collapses underscores', () => {
    expect(slugify('Physics (fixed)')).toBe('physics-fixed');
    expect(slugify('a_b c')).toBe('a-b-c');
  });

  it('prefixes a leading digit so the result is a valid CSS identifier', () => {
    expect(slugify('3D Render')).toBe('_3d-render');
  });
});
