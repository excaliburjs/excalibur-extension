/*
 * PAGE FUNCTION MODULE — every exported function here is serialized into the
 * inspected page via Function.prototype.toString (chrome.scripting.executeScript
 * with world: 'MAIN'), or called directly by the embedded build.
 *
 * Constraints (enforced by eslint no-restricted-imports on src/page/**):
 * - No runtime imports and no references to module scope — bodies must be
 *   fully self-contained (type-only imports are fine).
 * - Arguments and return values must be JSON-serializable.
 * - Return sentinels (null / no-op) when no game exists — never throw.
 * - es2016 syntax only; the code runs verbatim in arbitrary pages.
 */

/**
 * Detects an Excalibur instance in the current frame; returns label info for
 * the instance picker (plus the master debug flag, read by the popup and the
 * badge) or null when the frame has no game.
 */
export function detectExcalibur() {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return null;
  }
  return {
    title: document.title || '',
    url: location.href,
    version: window.___EXCALIBUR_DEVTOOL.version || '???',
    isDebug: !!window.___EXCALIBUR_DEVTOOL.isDebug
  };
}
