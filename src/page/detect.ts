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
 *
 * Also installs the fatal-exception recorder on first sight of a game: the
 * engine's clock calls `engine.onFatalException(e)` — a public, late-bound
 * property — right before stopping the game loop, so wrapping it records
 * crashes as they happen. The wrapper stores a sanitized error on
 * `window.___EXCALIBUR_DEVTOOL_EXTENSION_FATAL` and then calls the previous
 * handler (the engine's default logger or the game's own), preserving its
 * behavior exactly. Idempotent per engine object: an HMR-swapped engine
 * re-arms, and engines without the hook are silently skipped. The recorded
 * error is reported in every later result until the page navigates, so
 * surfaces that were not watching at crash time still see it — but a crash
 * before the first detect pass in a frame is never recorded (opportunistic,
 * like the badge).
 */
export function detectExcalibur() {
  const game = window.___EXCALIBUR_DEVTOOL;
  if (!game) {
    return null;
  }

  if (typeof game.onFatalException === 'function') {
    let recorder = window.___EXCALIBUR_DEVTOOL_EXTENSION_FATAL;
    if (!recorder) {
      recorder = { engine: null, error: null };
      window.___EXCALIBUR_DEVTOOL_EXTENSION_FATAL = recorder;
    }
    if (recorder.engine !== game) {
      // a fresh engine object (HMR, re-created game) has not crashed — the
      // previous engine's error no longer describes this frame's game
      recorder.engine = game;
      recorder.error = null;
      // captured separately: TS narrowing does not survive the closure below
      const trackedRecorder = recorder;
      const previous = game.onFatalException;
      game.onFatalException = (e) => {
        try {
          trackedRecorder.error = {
            // non-Error throws (strings, plain objects) still need a readable message
            message: e && e.message !== undefined ? String(e.message) : String(e),
            stack: e && typeof e.stack === 'string' ? e.stack.slice(0, 16384) : '',
            time: Date.now()
          };
        } catch {
          // recording must never break the game's own handler
        }
        previous(e);
      };
    }
  }

  return {
    title: document.title || '',
    url: location.href,
    version: game.version || '???',
    isDebug: !!game.isDebug,
    fatalError: (window.___EXCALIBUR_DEVTOOL_EXTENSION_FATAL && window.___EXCALIBUR_DEVTOOL_EXTENSION_FATAL.error) || null
  };
}
