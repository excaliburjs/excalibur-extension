/**
 * Color type matching Excalibur's Color structure
 */
export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export const black: Color = { r: 0, g: 0, b: 0, a: 1.0 };
export const transparent: Color = { r: 0, g: 0, b: 0, a: 0.0 };
export const red: Color = { r: 255, g: 0, b: 0, a: 1.0 };
export const green: Color = { r: 0, g: 255, b: 0, a: 1.0 };
export const blue: Color = { r: 0, g: 0, b: 255, a: 1.0 };
export const yellow: Color = { r: 255, g: 255, b: 0, a: 1.0 };
export const white: Color = { r: 255, g: 255, b: 255, a: 1.0 };

/**
 * Convert hex color string to Color object
 */
export function hexToColor(hex: string): Color {
  hex = hex.substring(1);
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  let a = 1.0;
  if (hex.length > 6) {
    a = parseInt(hex.substring(6, 8), 16) / 255;
  }
  return { r, g, b, a };
}

/**
 * Convert Color object to hex string
 */
export function colorToHex(color: Color): string {
  const r = color.r.toString(16).padStart(2, '0');
  const g = color.g.toString(16).padStart(2, '0');
  const b = color.b.toString(16).padStart(2, '0');
  const a = Math.floor(color.a * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${r}${g}${b}${a}`;
}

/**
 * Set a value at a nested path in an object, creating intermediate objects if needed.
 * @example setByPath(obj, 'debug.transform.showZIndex', true)
 */
export function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let target = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!(key in target)) {
      target[key] = {};
    }
    target = target[key] as Record<string, unknown>;
  }
  target[parts[parts.length - 1]] = value;
}

/**
 * Patch a value at a nested path in an existing object.
 * Silently skips if the path doesn't exist (safe for patching game objects).
 * @example patchByPath(game, 'debug.transform.showZIndex', true)
 */
export function patchByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let target: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (target[key] === undefined || target[key] === null) {
      return; // Path doesn't exist, skip
    }
    target = target[key] as Record<string, unknown>;
  }
  target[parts[parts.length - 1]] = value;
}

/**
 * Get a value from a nested path in an object
 * @example getByPath(obj, 'debug.transform.showZIndex')
 */
export function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let target: unknown = obj;
  for (const part of parts) {
    if (target == null || typeof target !== 'object') {
      return undefined;
    }
    target = (target as Record<string, unknown>)[part];
  }
  return target;
}
