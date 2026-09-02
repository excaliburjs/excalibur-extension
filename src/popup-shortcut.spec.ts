import { describe, expect, it } from 'vitest';
import { comboFromEvent, isReservedCombo, prettifyCombo, type ShortcutEventLike } from './popup-shortcut';

function keyEvent(partial: Partial<ShortcutEventLike>): ShortcutEventLike {
  return { key: '', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...partial };
}

describe('comboFromEvent', () => {
  it('builds the default debug shortcut', () => {
    expect(comboFromEvent(keyEvent({ key: 'd', altKey: true, shiftKey: true }), false)).toBe('Alt+Shift+D');
  });

  it('orders modifiers canonically and uppercases the key', () => {
    expect(comboFromEvent(keyEvent({ key: 'x', ctrlKey: true, shiftKey: true }), false)).toBe('Ctrl+Shift+X');
    expect(comboFromEvent(keyEvent({ key: 'f', ctrlKey: true, altKey: true, shiftKey: true }), false)).toBe('Ctrl+Alt+Shift+F');
  });

  it('maps ctrl/meta to MacCtrl/Command on mac', () => {
    expect(comboFromEvent(keyEvent({ key: 'd', metaKey: true, shiftKey: true }), true)).toBe('Command+Shift+D');
    expect(comboFromEvent(keyEvent({ key: 'd', ctrlKey: true, shiftKey: true }), true)).toBe('MacCtrl+Shift+D');
  });

  it('rejects the Windows/Super key outside mac', () => {
    expect(comboFromEvent(keyEvent({ key: 'd', metaKey: true }), false)).toBeNull();
  });

  it('returns null while only modifiers are held', () => {
    expect(comboFromEvent(keyEvent({ key: 'Shift', shiftKey: true }), false)).toBeNull();
    expect(comboFromEvent(keyEvent({ key: 'Alt', altKey: true }), false)).toBeNull();
    expect(comboFromEvent(keyEvent({ key: 'Control', ctrlKey: true }), false)).toBeNull();
  });

  it('requires a primary modifier (Shift alone is not enough)', () => {
    expect(comboFromEvent(keyEvent({ key: 'd', shiftKey: true }), false)).toBeNull();
    expect(comboFromEvent(keyEvent({ key: 'd' }), false)).toBeNull();
  });

  it('rejects punctuation and accepts digits and F1–F12', () => {
    expect(comboFromEvent(keyEvent({ key: '-', ctrlKey: true }), false)).toBeNull();
    expect(comboFromEvent(keyEvent({ key: '5', ctrlKey: true }), false)).toBe('Ctrl+5');
    expect(comboFromEvent(keyEvent({ key: 'F12', ctrlKey: true, shiftKey: true }), false)).toBe('Ctrl+Shift+F12');
    expect(comboFromEvent(keyEvent({ key: 'F13', ctrlKey: true }), false)).toBeNull();
  });

  it('ignores dead keys', () => {
    expect(comboFromEvent(keyEvent({ key: 'Dead', altKey: true }), false)).toBeNull();
  });
});

describe('isReservedCombo', () => {
  it('blocks browser-reserved chords across platforms', () => {
    expect(isReservedCombo('Ctrl+T')).toBe(true);
    expect(isReservedCombo('Ctrl+Shift+D')).toBe(true); // Firefox: bookmark all tabs
    expect(isReservedCombo('Ctrl+Shift+I')).toBe(true); // devtools
    expect(isReservedCombo('Ctrl+1')).toBe(true); // tab selection
    expect(isReservedCombo('Command+W')).toBe(true); // mac close tab
  });

  it('allows the default and other free combos', () => {
    expect(isReservedCombo('Alt+Shift+D')).toBe(false);
    expect(isReservedCombo('Ctrl+Shift+X')).toBe(false);
    expect(isReservedCombo('MacCtrl+Shift+D')).toBe(false);
  });
});

describe('prettifyCombo', () => {
  it('keeps API spelling outside mac', () => {
    expect(prettifyCombo('Alt+Shift+D', false)).toBe('Alt+Shift+D');
  });

  it('uses mac glyphs on mac', () => {
    expect(prettifyCombo('Alt+Shift+D', true)).toBe('⌥⇧D');
    expect(prettifyCombo('Command+Shift+D', true)).toBe('⌘⇧D');
  });
});
