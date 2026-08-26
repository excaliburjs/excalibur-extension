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
import type { TestClock } from '../@types/excalibur';

/**
 * Steps the clock forwarding the amount of milliseconds passed.
 */
export function stepClock(stepMs: number) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  try {
    (game.clock as TestClock).step(stepMs);
  } catch {
    // only works on test clock
  }
}

/**
 * Stops the clock.
 */
export function stopClock() {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
  }
  const game = window.___EXCALIBUR_DEVTOOL;

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  game.clock.stop();
}

/**
 * Starts the clock.
 */
export function startClock() {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  game.clock.start();
}

/**
 * Toggles between the test toggle and the standard clock.
 */
export function toggleTestClock() {
  if (window.___EXCALIBUR_DEVTOOL) {
    /**
     * @typedef {import('./@types/excalibur').Engine} Engine
     * @type {Engine}
     */
    const game = window.___EXCALIBUR_DEVTOOL;
    if (!window.___EXCALIBUR_DEVTOOL_EXTENSION_TESTCLOCK) {
      window.___EXCALIBUR_DEVTOOL_EXTENSION_TESTCLOCK = true;
      game.debug.useTestClock();
    } else {
      window.___EXCALIBUR_DEVTOOL_EXTENSION_TESTCLOCK = false;
      game.debug.useStandardClock();
    }
  }
}
