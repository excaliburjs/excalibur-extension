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
 * Set Color Blind Mode
 */
export function setColorBlind(colorBlindMode: string) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  if (colorBlindMode === 'Normal') {
    game.debug.colorBlindMode.clear();
  } else {
    game.debug.colorBlindMode.simulate(colorBlindMode as Parameters<typeof game.debug.colorBlindMode.simulate>[0]);
  }
}

/**
 * Go to scene
 */
export function goToScene(sceneName: string) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  game.goToScene(sceneName);
}

/**
 * Updates physics related settings.
 * @typedef {import('./components/physics-settings').Physics} Physics
 * @param {Physics} settings
 */
export function updatePhysics(settings: { config: Record<string, unknown> }) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
  }

  /**
   * Performs a deep merge of objects and returns mutated first object.
   * @param {...object} objects - Objects to merge
   * @returns {object} New object with merged key/values
   */
  function mergeDeep(...objects: Record<string, unknown>[]) {
    const isObject = (obj: unknown) => obj && typeof obj === 'object';

    return objects.reduce((prev, obj) => {
      Object.keys(obj).forEach((key) => {
        const pVal = prev[key];
        const oVal = obj[key];
        if (Array.isArray(pVal) && Array.isArray(oVal)) {
          prev[key] = pVal.concat(...oVal);
        } else if (isObject(pVal) && isObject(oVal)) {
          prev[key] = mergeDeep(pVal as Record<string, unknown>, oVal as Record<string, unknown>);
        } else {
          prev[key] = oVal;
        }
      });
      return prev;
    }, objects[0]); // keep first object reference
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  (game as unknown as { physics: Record<string, unknown> }).physics = mergeDeep(
    game.physics as unknown as Record<string, unknown>,
    settings.config
  );
}
