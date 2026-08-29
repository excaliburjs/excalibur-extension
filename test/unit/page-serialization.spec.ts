import { describe, expect, it } from 'vitest';
import * as vm from 'node:vm';
import { detectExcalibur } from '../../src/page/detect';
import { startClock, stepClock, stopClock, toggleTestClock } from '../../src/page/clock';
import { getEntityGraphics, identifyEntity, kill, updateEntityProperty, useEntityGraphic } from '../../src/page/entities';
import { setPickerIgnored, startEntityPicker, stopEntityPicker } from '../../src/page/picker';
import { goToScene, setColorBlind, updatePhysics } from '../../src/page/scene';
import { getMaterialDetail, updateMaterialUniform } from '../../src/page/materials';
import { getPipelineDetail, updatePassUniform } from '../../src/page/pipeline';
import { inject } from '../../src/page/inject';

/*
 * Every function in src/page/ is injected into the inspected page by
 * serializing it with Function.prototype.toString — so its body must be fully
 * self-contained: no closures over module scope, no imported helpers, nothing
 * but its own arguments and page globals.
 *
 * This spec mechanically enforces that: each function is round-tripped through
 * its own source text into a bare VM context that contains only a stub
 * `window` (with no game on it). A leaked reference to module scope throws a
 * ReferenceError here long before it fails at runtime in a real tab.
 */

// name → [function, expected no-game sentinel return]
const pageFunctions: Record<string, [(...args: never[]) => unknown, unknown]> = {
  detectExcalibur: [detectExcalibur, null],
  stepClock: [stepClock, undefined],
  stopClock: [stopClock, undefined],
  startClock: [startClock, undefined],
  toggleTestClock: [toggleTestClock, undefined],
  kill: [kill, undefined],
  identifyEntity: [identifyEntity, undefined],
  startEntityPicker: [startEntityPicker, undefined],
  stopEntityPicker: [stopEntityPicker, undefined],
  setPickerIgnored: [setPickerIgnored, undefined],
  setColorBlind: [setColorBlind, undefined],
  goToScene: [goToScene, undefined],
  updatePhysics: [updatePhysics, undefined],
  updateMaterialUniform: [updateMaterialUniform, undefined],
  // The on-demand fetchers stringify their whole payload, sentinel included
  getMaterialDetail: [getMaterialDetail, JSON.stringify(null)],
  getEntityGraphics: [getEntityGraphics, JSON.stringify(null)],
  getPipelineDetail: [getPipelineDetail, JSON.stringify(null)],
  updatePassUniform: [updatePassUniform, undefined],
  updateEntityProperty: [updateEntityProperty, undefined],
  useEntityGraphic: [useEntityGraphic, undefined],
  inject: [inject, null]
};

describe('page function serialization (closure-free invariant)', () => {
  for (const [name, [fn, sentinel]] of Object.entries(pageFunctions)) {
    it(`${name} evaluates and runs in a bare page context with no game`, () => {
      const source = fn.toString();

      // A minimal page: a window with no ___EXCALIBUR_DEVTOOL on it
      const sandbox: Record<string, unknown> = { window: {} };
      vm.createContext(sandbox);

      // Throws SyntaxError/ReferenceError at eval time if the serialized text
      // is not standalone-parseable
      const revived = vm.runInContext(`(${source})`, sandbox) as (...args: unknown[]) => unknown;

      // Calling with no args exercises the "no game" sentinel path; a function
      // that touches its arguments or module scope before the window guard
      // throws here
      expect(revived(), name).toBe(sentinel);
    });
  }
});
