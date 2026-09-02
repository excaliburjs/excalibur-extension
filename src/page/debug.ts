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
 * Toggles the game's master debug flag in this frame to the target state,
 * using the same at-most-two-calls dance as inject's heartbeat application
 * (game.toggleDebug() returns the state it toggled to), so the flag lands on
 * the target regardless of the starting state. Used by the toolbar popup's
 * quick toggle, which applies it to every detected frame of the tab.
 * @param {boolean} target - Desired debug state
 */
export function quickToggleDebug(target: boolean) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return null;
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;

  if (target === true) {
    if (game.toggleDebug() === false) {
      game.toggleDebug();
    }
  } else if (target === false) {
    if (game.toggleDebug() === true) {
      game.toggleDebug();
    }
  }
  return { isDebug: !!game.isDebug };
}
