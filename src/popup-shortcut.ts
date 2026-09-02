/**
 * Pure helpers for building and validating `commands` API shortcut strings
 * from keyboard events (used by the popup's remap capture UI). No DOM or
 * extension APIs are touched here, so these are unit-testable in node.
 */

/**
 * The keyboard-event shape the combo helpers read — structurally compatible
 * with DOM KeyboardEvent so the popup passes it straight through.
 */
export interface ShortcutEventLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

/**
 * Combos the browsers reserve for themselves (Win/Linux `Ctrl+…` and mac
 * `Command+…` forms). Trying to claim one either gets rejected by
 * `commands.update` or would shadow a browser chord, so the remap UI
 * blocks them up front with a clear message.
 */
const RESERVED_COMBOS = new Set([
  // tabs & windows
  'Ctrl+T',
  'Ctrl+W',
  'Ctrl+N',
  'Ctrl+Shift+N',
  'Ctrl+Shift+T',
  'Ctrl+Shift+W',
  'Command+T',
  'Command+W',
  'Command+N',
  'Command+Shift+N',
  'Command+Shift+T',
  'Command+Shift+W',
  // address bar & search
  'Ctrl+L',
  'Ctrl+K',
  'Ctrl+E',
  'Alt+D',
  'Command+L',
  // bookmarks, history, downloads, panels
  'Ctrl+D',
  'Ctrl+Shift+D',
  'Ctrl+Shift+O',
  'Ctrl+Shift+B',
  'Ctrl+Shift+Y',
  'Ctrl+Shift+E',
  'Ctrl+Shift+K',
  'Ctrl+Shift+P',
  'Ctrl+Shift+M',
  'Ctrl+Shift+A',
  'Ctrl+H',
  'Ctrl+J',
  'Ctrl+O',
  'Ctrl+U',
  'Command+D',
  'Command+Shift+D',
  'Command+O',
  // devtools
  'Ctrl+Shift+I',
  'Ctrl+Shift+J',
  'Ctrl+Shift+C',
  'Command+Option+I',
  'Command+Option+J',
  'Command+Option+C',
  // page actions
  'Ctrl+R',
  'Ctrl+Shift+R',
  'Ctrl+F',
  'Ctrl+P',
  'Ctrl+S',
  'Ctrl+F5',
  'Command+R',
  'Command+Shift+R',
  'Command+F',
  'Command+P',
  'Command+S',
  // tab selection & zoom (digits)
  'Ctrl+0',
  'Ctrl+1',
  'Ctrl+2',
  'Ctrl+3',
  'Ctrl+4',
  'Ctrl+5',
  'Ctrl+6',
  'Ctrl+7',
  'Ctrl+8',
  'Ctrl+9',
  'Command+0',
  'Command+1',
  'Command+2',
  'Command+3',
  'Command+4',
  'Command+5',
  'Command+6',
  'Command+7',
  'Command+8',
  'Command+9'
]);

/**
 * Builds a `commands`-API shortcut string ("Alt+Shift+D") from a keydown
 * event shape, or null while the combo is incomplete or unusable (bare
 * modifiers, no primary modifier, punctuation, or the Windows/Super key on
 * non-mac platforms where the API has no representation for it).
 * @param e - The keydown event (or an equivalent shape)
 * @param isMac - Maps ctrl/meta to MacCtrl/Command the way the API expects
 */
export function comboFromEvent(e: ShortcutEventLike, isMac: boolean): string | null {
  // Command is a mac-only modifier token — the Windows/Super key has no
  // commands-API spelling on other platforms
  if (e.metaKey && !isMac) {
    return null;
  }
  const modifiers: string[] = [];
  if (e.metaKey) {
    modifiers.push('Command');
  }
  if (e.ctrlKey) {
    modifiers.push(isMac ? 'MacCtrl' : 'Ctrl');
  }
  if (e.altKey) {
    modifiers.push('Alt');
  }
  if (e.shiftKey) {
    modifiers.push('Shift');
  }
  // the API requires a primary modifier; Shift alone never qualifies
  if (modifiers.length === 0 || (modifiers.length === 1 && modifiers[0] === 'Shift')) {
    return null;
  }
  let key = '';
  if (e.key.length === 1) {
    const upper = e.key.toUpperCase();
    if (/[A-Z0-9]/.test(upper)) {
      key = upper;
    }
  } else if (/^F([1-9]|1[0-2])$/.test(e.key)) {
    key = e.key;
  }
  // no usable key yet (modifier-only press, dead key, punctuation, …)
  if (!key) {
    return null;
  }
  return modifiers.concat(key).join('+');
}

/**
 * Reports whether a combo string is reserved by the browser itself (see
 * RESERVED_COMBOS) and can therefore not be claimed by the extension.
 * @param combo - A combo string produced by comboFromEvent
 */
export function isReservedCombo(combo: string): boolean {
  return RESERVED_COMBOS.has(combo);
}

/**
 * Renders a combo for display: mac gets the conventional modifier glyphs
 * ("⌥⇧D"); everything else keeps the API spelling ("Alt+Shift+D").
 * @param combo - A combo string produced by comboFromEvent (or getAll)
 * @param isMac - Whether to use mac glyphs
 */
export function prettifyCombo(combo: string, isMac: boolean): string {
  if (!isMac) {
    return combo;
  }
  const glyphs: Record<string, string> = { Command: '⌘', MacCtrl: '⌃', Ctrl: '⌃', Alt: '⌥', Shift: '⇧' };
  return combo
    .split('+')
    .map((part) => glyphs[part] ?? part)
    .join('');
}
