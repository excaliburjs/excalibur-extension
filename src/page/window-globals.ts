/**
 * Ambient declarations for the globals the page functions read and write on
 * the inspected page's window. Types only — this module must never emit
 * runtime code.
 *
 * `___EXCALIBUR_DEVTOOL` (three underscores) is set unconditionally by the
 * Engine constructor; the `_EXTENSION_` globals are sentinels owned by the
 * devtools page functions themselves.
 */
import type { Engine } from '../@types/excalibur';

declare global {
  interface Window {
    ___EXCALIBUR_DEVTOOL?: Engine;
    ___EXCALIBUR_DEVTOOL_EXTENSION_TESTCLOCK?: boolean;
    ___EXCALIBUR_DEVTOOL_EXTENSION_MATERIAL_ID?: number;
    ___EXCALIBUR_DEVTOOL_EXTENSION_PP_ID?: number;
    ___EXCALIBUR_DEVTOOL_EXTENSION_PICKER?: {
      seq: number;
      pickedId: number | null;
      hovered: { id: number; name: string; ctor: string } | null;
      ignoredCtors: string[];
      ignoredNames: string[];
      teardown: () => void;
    };
  }
}

export {};
