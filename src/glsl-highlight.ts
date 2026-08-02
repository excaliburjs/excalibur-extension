import { html, type TemplateResult } from 'lit';

const KEYWORDS = new Set([
  'if',
  'else',
  'for',
  'while',
  'do',
  'return',
  'break',
  'continue',
  'discard',
  'struct',
  'precision',
  'layout',
  'const',
  'uniform',
  'in',
  'out',
  'inout',
  'flat',
  'centroid',
  'invariant',
  'smooth',
  'switch',
  'case',
  'default',
  'true',
  'false',
  'highp',
  'mediump',
  'lowp'
]);

const TYPES = new Set([
  'void',
  'bool',
  'int',
  'uint',
  'float',
  'double',
  'vec2',
  'vec3',
  'vec4',
  'ivec2',
  'ivec3',
  'ivec4',
  'uvec2',
  'uvec3',
  'uvec4',
  'bvec2',
  'bvec3',
  'bvec4',
  'mat2',
  'mat3',
  'mat4',
  'mat2x2',
  'mat2x3',
  'mat2x4',
  'mat3x2',
  'mat3x3',
  'mat3x4',
  'mat4x2',
  'mat4x3',
  'mat4x4',
  'sampler2D',
  'sampler3D',
  'samplerCube',
  'sampler2DArray',
  'sampler2DShadow',
  'samplerCubeShadow',
  'isampler2D',
  'isampler3D',
  'usampler2D',
  'usampler3D'
]);

const BUILTINS = new Set([
  'texture',
  'texelFetch',
  'textureSize',
  'textureLod',
  'textureProj',
  'textureGrad',
  'mix',
  'clamp',
  'dot',
  'cross',
  'normalize',
  'length',
  'distance',
  'pow',
  'exp',
  'exp2',
  'log',
  'log2',
  'sqrt',
  'inversesqrt',
  'abs',
  'sign',
  'floor',
  'ceil',
  'round',
  'trunc',
  'fract',
  'mod',
  'min',
  'max',
  'step',
  'smoothstep',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'radians',
  'degrees',
  'dFdx',
  'dFdy',
  'fwidth',
  'reflect',
  'refract',
  'faceforward',
  'transpose',
  'inverse',
  'determinant',
  'matrixCompMult',
  'outerProduct',
  'equal',
  'notEqual',
  'lessThan',
  'lessThanEqual',
  'greaterThan',
  'greaterThanEqual',
  'any',
  'all',
  'not',
  'isnan',
  'isinf',
  'floatBitsToInt',
  'intBitsToFloat',
  'packHalf2x16',
  'unpackHalf2x16'
]);

// groups: 1 = comment, 2 = preprocessor line, 3 = number, 4 = identifier
const TOKEN_REGEX =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|(^[ \t]*#[^\n]*)|(0[xX][\da-fA-F]+[uU]?|\d+\.\d*(?:[eE][+-]?\d+)?[fF]?|\.\d+(?:[eE][+-]?\d+)?[fF]?|\d+(?:[eE][+-]?\d+)?(?:[uU]|[fF])?)|([A-Za-z_]\w*)/gm;

/**
 * Tokenizes GLSL source into lit templates with `tok-*` classed spans for
 * comments, preprocessor lines, numbers, keywords, types, and built-ins.
 * Plain text is passed through as strings, so no HTML escaping is needed —
 * everything is interpolated through lit.
 */
export function highlightGlsl(source: string): Array<TemplateResult | string> {
  const parts: Array<TemplateResult | string> = [];
  let last = 0;
  TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_REGEX.exec(source)) !== null) {
    const text = match[0];
    if (match.index > last) {
      parts.push(source.slice(last, match.index));
    }
    let cls: string | null = null;
    if (match[1]) {
      cls = 'tok-comment';
    } else if (match[2]) {
      cls = 'tok-preproc';
    } else if (match[3]) {
      cls = 'tok-number';
    } else if (match[4]) {
      if (KEYWORDS.has(text)) {
        cls = 'tok-keyword';
      } else if (TYPES.has(text)) {
        cls = 'tok-type';
      } else if (BUILTINS.has(text) || text.startsWith('gl_')) {
        cls = 'tok-builtin';
      }
    }
    parts.push(cls ? html`<span class=${cls}>${text}</span>` : text);
    last = match.index + text.length;
  }
  if (last < source.length) {
    parts.push(source.slice(last));
  }
  return parts;
}
