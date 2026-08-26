// @vitest-environment jsdom
// lit-html touches `document` at module load, so this spec runs under jsdom.
import { describe, expect, it } from 'vitest';
import type { TemplateResult } from 'lit';
import { highlightGlsl } from './glsl-highlight';

interface Token {
  cls: string | null;
  text: string;
}

// Each highlighted token is html`<span class=${cls}>${text}</span>` — so the
// TemplateResult's values are [cls, text]. Plain text passes through as strings.
function toTokens(parts: ReturnType<typeof highlightGlsl>): Token[] {
  return parts.map((part) => {
    if (typeof part === 'string') {
      return { cls: null, text: part };
    }
    const values = (part as TemplateResult).values as [string, string];
    return { cls: values[0], text: values[1] };
  });
}

function classified(source: string): Token[] {
  return toTokens(highlightGlsl(source)).filter((token) => token.cls !== null);
}

function reconstruct(source: string): string {
  return toTokens(highlightGlsl(source))
    .map((token) => token.text)
    .join('');
}

describe('highlightGlsl', () => {
  it('reproduces the source verbatim when all parts are concatenated', () => {
    const source = `#version 300 es
precision mediump float; // trailing
uniform vec4 u_color;
void main() {
  gl_FragColor = mix(u_color, vec4(1.0), 0.5); /* done */
}`;
    expect(reconstruct(source)).toBe(source);
  });

  it('classifies keywords, types, and numbers', () => {
    const tokens = classified('uniform float x = 1.5;');
    expect(tokens).toEqual([
      { cls: 'tok-keyword', text: 'uniform' },
      { cls: 'tok-type', text: 'float' },
      { cls: 'tok-number', text: '1.5' }
    ]);
  });

  it('leaves unknown identifiers and punctuation as plain text', () => {
    const tokens = toTokens(highlightGlsl('myVar = other;'));
    expect(tokens.every((token) => token.cls === null)).toBe(true);
    expect(tokens.map((token) => token.text).join('')).toBe('myVar = other;');
  });

  it('classifies built-in functions and gl_-prefixed identifiers', () => {
    expect(classified('texture(sampler, uv)')).toEqual([{ cls: 'tok-builtin', text: 'texture' }]);
    expect(classified('gl_FragCoord')).toEqual([{ cls: 'tok-builtin', text: 'gl_FragCoord' }]);
  });

  it('classifies line and block comments, including keywords inside them', () => {
    expect(classified('// uniform float')).toEqual([{ cls: 'tok-comment', text: '// uniform float' }]);
    expect(classified('/* if (x)\n   return */')).toEqual([{ cls: 'tok-comment', text: '/* if (x)\n   return */' }]);
  });

  it('classifies preprocessor lines only at line start (with leading whitespace)', () => {
    expect(classified('#version 300 es')).toEqual([{ cls: 'tok-preproc', text: '#version 300 es' }]);
    expect(classified('  \t#define PI 3.14')).toEqual([{ cls: 'tok-preproc', text: '  \t#define PI 3.14' }]);

    // A # after other content on the line is not a preprocessor directive
    const midLine = classified('x #define');
    expect(midLine.map((token) => token.cls)).not.toContain('tok-preproc');
  });

  it('classifies number literal variants', () => {
    expect(classified('0xFF 1.0 .5 1e3 2.5e-4 3u 4f')).toEqual([
      { cls: 'tok-number', text: '0xFF' },
      { cls: 'tok-number', text: '1.0' },
      { cls: 'tok-number', text: '.5' },
      { cls: 'tok-number', text: '1e3' },
      { cls: 'tok-number', text: '2.5e-4' },
      { cls: 'tok-number', text: '3u' },
      { cls: 'tok-number', text: '4f' }
    ]);
  });

  it('is stateless across calls (module-level regex lastIndex is reset)', () => {
    const source = 'uniform float x;';
    const first = toTokens(highlightGlsl(source));
    const second = toTokens(highlightGlsl(source));
    expect(second).toEqual(first);
  });
});
