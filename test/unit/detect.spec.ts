import { describe, expect, it } from 'vitest';
import * as vm from 'node:vm';
import { detectExcalibur } from '../../src/page/detect';

/*
 * detectExcalibur is serialized into the inspected page via
 * Function.prototype.toString, so its fatal-exception recorder must be fully
 * self-contained. These specs round-trip the serialized source into a bare VM
 * (like page-serialization.spec.ts) but WITH a fake engine on the window, to
 * pin down the recorder's behavior: install-once, chain to the previous
 * handler, record sanitized errors, re-arm on an HMR-swapped engine.
 */

interface FatalRecord {
  message: string;
  stack: string;
  time: number;
}

interface FatalGlobal {
  engine: unknown;
  error: FatalRecord | null;
}

interface FakeEngine {
  version: string;
  isDebug: boolean;
  onFatalException: (e: unknown) => void;
}

/**
 * Revives the serialized detectExcalibur in a sandbox with a fake engine
 * (and a handler that records calls), plus the document/location stubs the
 * detect result reads.
 */
function reviveDetect(engine: FakeEngine) {
  const sandbox: Record<string, unknown> = {
    window: { ___EXCALIBUR_DEVTOOL: engine },
    document: { title: 'Test Page' },
    location: { href: 'http://test/game' }
  };
  vm.createContext(sandbox);
  const detect = vm.runInContext(`(${detectExcalibur.toString()})`, sandbox) as () => {
    title: string;
    url: string;
    version: string;
    isDebug: boolean;
    fatalError: FatalRecord | null;
  };
  return {
    detect,
    fatalGlobal: () => (sandbox.window as { ___EXCALIBUR_DEVTOOL_EXTENSION_FATAL?: FatalGlobal }).___EXCALIBUR_DEVTOOL_EXTENSION_FATAL,
    setEngine: (next: FakeEngine) => {
      (sandbox.window as { ___EXCALIBUR_DEVTOOL?: FakeEngine }).___EXCALIBUR_DEVTOOL = next;
    }
  };
}

/** A fake engine whose onFatalException counts calls and received values. */
function fakeEngine(version = '0.33.0') {
  const calls: unknown[] = [];
  const engine: FakeEngine = {
    version,
    isDebug: false,
    onFatalException: (e: unknown) => {
      calls.push(e);
    }
  };
  return { engine, calls };
}

describe('detectExcalibur fatal-exception recorder', () => {
  it('reports instance info with fatalError null while the game runs clean', () => {
    const { engine } = fakeEngine();
    const { detect } = reviveDetect(engine);

    const result = detect();
    expect(result).toEqual({
      title: 'Test Page',
      url: 'http://test/game',
      version: '0.33.0',
      isDebug: false,
      fatalError: null
    });
  });

  it('records a thrown Error and still calls the previous handler', () => {
    const { engine, calls } = fakeEngine();
    const { detect, fatalGlobal } = reviveDetect(engine);

    detect();
    const boom = new Error('fatal: boom');
    engine.onFatalException(boom);

    expect(calls).toEqual([boom]);
    const error = fatalGlobal()?.error;
    expect(error?.message).toBe('fatal: boom');
    expect(typeof error?.stack).toBe('string');
    expect(error?.stack).toContain('fatal: boom');
    expect(typeof error?.time).toBe('number');

    // the next detect pass reports the recorded error
    expect(detect().fatalError?.message).toBe('fatal: boom');
  });

  it('wraps exactly once across repeated detect passes', () => {
    const { engine, calls } = fakeEngine();
    const { detect } = reviveDetect(engine);

    detect();
    const wrapped = engine.onFatalException;
    detect();
    detect();
    // a double wrap would replace the property with a fresh chain
    expect(engine.onFatalException).toBe(wrapped);

    engine.onFatalException(new Error('fatal: boom'));
    expect(calls.length).toBe(1);
  });

  it('sanitizes non-Error throws and caps the stack size', () => {
    const { engine } = fakeEngine();
    const { detect, fatalGlobal } = reviveDetect(engine);

    detect();
    engine.onFatalException('just a string');
    expect(fatalGlobal()?.error?.message).toBe('just a string');
    expect(fatalGlobal()?.error?.stack).toBe('');

    const wide = new Error('wide');
    wide.stack = 'x'.repeat(20000);
    engine.onFatalException(wide);
    expect(fatalGlobal()?.error?.stack?.length).toBe(16384);
  });

  it('re-arms (and clears the old error) when HMR swaps in a new engine', () => {
    const first = fakeEngine('0.33.0');
    const { detect, fatalGlobal, setEngine } = reviveDetect(first.engine);

    detect();
    first.engine.onFatalException(new Error('fatal: first'));
    expect(fatalGlobal()?.error?.message).toBe('fatal: first');

    const second = fakeEngine('0.33.1');
    setEngine(second.engine);
    const result = detect();
    // the fresh engine has not crashed — the old error must not leak onto it
    expect(result.version).toBe('0.33.1');
    expect(result.fatalError).toBe(null);

    second.engine.onFatalException(new Error('fatal: second'));
    expect(fatalGlobal()?.error?.message).toBe('fatal: second');
    expect(fatalGlobal()?.engine).toBe(second.engine);
    expect(detect().fatalError?.message).toBe('fatal: second');
  });

  it('silently skips engines without the onFatalException hook', () => {
    const engine = { version: '0.30.0', isDebug: false } as unknown as FakeEngine;
    const { detect, fatalGlobal } = reviveDetect(engine);

    const result = detect();
    expect(result.version).toBe('0.30.0');
    expect(result.fatalError).toBe(null);
    expect(fatalGlobal()).toBeUndefined();
  });
});
