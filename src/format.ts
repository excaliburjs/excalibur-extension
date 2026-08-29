/**
 * Pure display-formatting helpers shared by the panel components.
 * This module must stay dependency-free (no lit, no Shoelace, no chrome
 * globals) so it can be unit-tested in plain Node.
 */

/**
 * Formats a number for display, trimming float noise to 4 decimal places.
 */
export function formatNumber(n: number): string {
  if (Number.isInteger(n)) {
    return n.toString();
  }
  return (Math.round(n * 10000) / 10000).toString();
}

/**
 * Formats a uniform value (scalar, boolean, or array) for display.
 */
export function formatValue(value: number | boolean | number[] | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value.toString();
  }
  if (typeof value === 'number') {
    return formatNumber(value);
  }
  return `[${value.map(formatNumber).join(', ')}]`;
}

/**
 * Formats a flat column-major matrix array (the GL convention returned by
 * gl.getUniform) as aligned rows for conventional row-major reading.
 */
export function formatMatrix(value: number[], dim: number): string {
  const rows: string[] = [];
  for (let r = 0; r < dim; r++) {
    const row: number[] = [];
    for (let c = 0; c < dim; c++) {
      row.push(value[r + c * dim]);
    }
    rows.push(row.map((n) => formatNumber(n).padStart(10)).join(' '));
  }
  return rows.join('\n');
}

/**
 * Formats a texture's sampling modes as "filtering · wrap" (e.g. "Pixel · Clamp"
 * or "Blended · Repeat×Mirror"), or null when unknown.
 */
export function formatSampling(texture: { filtering?: string | null; wrapX?: string | null; wrapY?: string | null }): string | null {
  const parts: string[] = [];
  if (texture.filtering) {
    parts.push(texture.filtering);
  }
  if (texture.wrapX || texture.wrapY) {
    const x = texture.wrapX ?? '?';
    const y = texture.wrapY ?? '?';
    parts.push(x === y ? x : `${x}×${y}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Coerces an unknown value to a number, falling back when it isn't one.
 */
export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

/**
 * Coerces an unknown value to an `{x, y}` vector with numeric components.
 */
export function asVector(value: unknown): { x: number; y: number } {
  const vec = value as { x?: unknown; y?: unknown } | null | undefined;
  return { x: asNumber(vec?.x), y: asNumber(vec?.y) };
}

/**
 * Formats an arbitrary serialized value for display: numbers are trimmed,
 * Infinity sentinels become symbols, vectors render as "(x, y)", and
 * everything else falls back to JSON.
 */
export function formatLoose(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'number') {
    return formatNumber(value);
  }
  if (value === 'Infinity') {
    return '∞';
  }
  if (value === '-Infinity') {
    return '-∞';
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatLoose).join(', ')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 2 && keys.includes('x') && keys.includes('y')) {
    return `(${formatLoose(obj.x)}, ${formatLoose(obj.y)})`;
  }
  return JSON.stringify(value);
}

/**
 * Case-insensitive sort with lowercase sorting before uppercase on an
 * otherwise-equal string (default JS sort puts 'A' before 'a', the opposite)
 */
export function sortIgnoreCase(values: string[]): string[] {
  return [...values].sort((a, b) => {
    const al = a.toLowerCase();
    const bl = b.toLowerCase();
    if (al !== bl) {
      return al < bl ? -1 : 1;
    }
    return a < b ? 1 : a > b ? -1 : 0;
  });
}

/** Slugifies a string for use as a CSS class or id. */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .replace(/^(\d)/, '_$1'); // Prefix with underscore if starts with digit
}
