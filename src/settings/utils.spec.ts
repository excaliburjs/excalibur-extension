import { describe, expect, it } from 'vitest';
import { colorToHex, getByPath, hexToColor, patchByPath, setByPath } from './utils';

describe('hexToColor', () => {
  it('parses an opaque hex color', () => {
    expect(hexToColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(hexToColor('#00ff00')).toEqual({ r: 0, g: 255, b: 0, a: 1 });
    expect(hexToColor('#123456')).toEqual({ r: 0x12, g: 0x34, b: 0x56, a: 1 });
  });

  it('parses an 8-digit hex color with alpha', () => {
    const color = hexToColor('#0000ff80');
    expect(color.r).toBe(0);
    expect(color.g).toBe(0);
    expect(color.b).toBe(255);
    expect(color.a).toBeCloseTo(128 / 255, 5);
  });

  it('is case-insensitive', () => {
    expect(hexToColor('#FF00FF')).toEqual({ r: 255, g: 0, b: 255, a: 1 });
  });
});

describe('colorToHex', () => {
  it('formats a color as an 8-digit hex string', () => {
    expect(colorToHex({ r: 255, g: 0, b: 0, a: 1 })).toBe('#ff0000ff');
    expect(colorToHex({ r: 0, g: 0, b: 0, a: 0 })).toBe('#00000000');
  });

  it('round-trips through hexToColor', () => {
    const original = { r: 18, g: 52, b: 86, a: 1 };
    expect(hexToColor(colorToHex(original))).toEqual(original);
  });
});

describe('setByPath', () => {
  it('sets a nested value, creating intermediate objects', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, 'debug.transform.showZIndex', true);
    expect(obj).toEqual({ debug: { transform: { showZIndex: true } } });
  });

  it('overwrites existing values without clobbering siblings', () => {
    const obj: Record<string, unknown> = { debug: { transform: { showZIndex: false, other: 1 } } };
    setByPath(obj, 'debug.transform.showZIndex', true);
    expect(obj).toEqual({ debug: { transform: { showZIndex: true, other: 1 } } });
  });

  it('sets a top-level value', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, 'flag', 42);
    expect(obj.flag).toBe(42);
  });
});

describe('patchByPath', () => {
  it('patches an existing nested value', () => {
    const obj: Record<string, unknown> = { debug: { transform: { showZIndex: false } } };
    patchByPath(obj, 'debug.transform.showZIndex', true);
    expect(getByPath(obj, 'debug.transform.showZIndex')).toBe(true);
  });

  it('silently skips when an intermediate is missing', () => {
    const obj: Record<string, unknown> = { debug: {} };
    patchByPath(obj, 'debug.transform.showZIndex', true);
    expect(obj).toEqual({ debug: {} });
  });

  it('silently skips when an intermediate is null', () => {
    const obj: Record<string, unknown> = { debug: null };
    patchByPath(obj, 'debug.transform.showZIndex', true);
    expect(obj).toEqual({ debug: null });
  });

  it('sets the leaf even when the leaf itself is currently undefined', () => {
    const obj: Record<string, unknown> = { debug: { transform: {} } };
    patchByPath(obj, 'debug.transform.showZIndex', true);
    expect(getByPath(obj, 'debug.transform.showZIndex')).toBe(true);
  });
});

describe('getByPath', () => {
  it('reads a nested value', () => {
    expect(getByPath({ a: { b: { c: 3 } } }, 'a.b.c')).toBe(3);
  });

  it('returns undefined for a missing path', () => {
    expect(getByPath({ a: {} }, 'a.b.c')).toBeUndefined();
    expect(getByPath({}, 'a')).toBeUndefined();
  });

  it('returns undefined when traversing through a primitive', () => {
    expect(getByPath({ a: 5 }, 'a.b')).toBeUndefined();
  });
});
