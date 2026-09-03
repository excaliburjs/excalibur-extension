import { afterEach, describe, expect, it } from 'vitest';
import { createConnection, type ConnectionHandle, type DriverPort } from '../../src/driver/connection';
import { directExecutor } from '../../src/embedded/local-driver';
import type { FatalErrorDialog } from '../../src/components/fatal-error-dialog';
import { mountPanel, type MountedPanel } from './helpers';
import type { ExInstance, HeartbeatMessage } from '../../src/protocol';
import { createFixtureGame, waitFor, type FixtureGame } from '../fixtures/game';

/**
 * A DriverPort that records everything the connection posts and lets the
 * test act as the panel side (delivering raw messages, reading heartbeats).
 * Duplicated from popup-toggle.spec.ts (spec-local, like there).
 */
function createRecordingPort() {
  const posted: object[] = [];
  const listeners: Array<(message: object) => void> = [];
  const port: DriverPort = {
    postMessage: (message) => posted.push(message),
    onMessage: (cb) => listeners.push(cb),
    onDisconnect: () => {
      // not exercised here; teardown goes through the handle's dispose
    }
  };
  return {
    port,
    posted,
    deliver: (message: object) => listeners.forEach((listener) => listener(message)),
    lastHeartbeat: (): HeartbeatMessage | undefined =>
      [...posted].reverse().find((m): m is HeartbeatMessage => (m as { name?: string }).name === 'ex-debug:heartbeat')
  };
}

/**
 * The fatal-error path, end to end: a real thrown error from the game's
 * update loop reaches the engine's onFatalException hook (which stops the
 * loop), the recorder installed by detectExcalibur captures it, and it rides
 * the heartbeat instances — the single carrier for the panel dialog, the
 * popup banner, and the badge.
 */
describe('fatal game error reporting (driver)', () => {
  let fixture: FixtureGame | undefined;
  let handle: ConnectionHandle | undefined;

  afterEach(() => {
    handle?.dispose();
    handle = undefined;
    fixture?.dispose();
    fixture = undefined;
  });

  it('reports a real loop crash in the heartbeat and fires the instance hook once', async () => {
    fixture = await createFixtureGame();
    const calls: Array<{ tabId: number | null; instances: ExInstance[] }> = [];
    const recorder = createRecordingPort();
    handle = createConnection(recorder.port, directExecutor, {
      onInstancesChanged: (tabId, instances) => calls.push({ tabId, instances })
    });

    recorder.deliver({ name: 'ex-debug:hello', tabId: 0 });
    // a clean heartbeat first — this is also the detect pass that installs
    // the fatal-exception recorder on the engine
    await waitFor(() => {
      const hb = recorder.lastHeartbeat();
      return hb && hb.instances.length === 1 && hb.instances[0].fatalError === null ? hb : undefined;
    });
    const hookCountBeforeCrash = calls.length;
    expect(calls[0].instances[0].fatalError ?? null).toBe(null);

    // crash the game for real: a throwing preupdate listener propagates to
    // the clock's catch, which calls engine.onFatalException and stops
    fixture.game.on('preupdate', () => {
      throw new Error('fatal: boom');
    });

    const error = await waitFor(() => recorder.lastHeartbeat()?.instances[0]?.fatalError ?? undefined);
    expect(error.message).toBe('fatal: boom');
    expect(error.stack).toContain('fatal: boom');
    expect(typeof error.time).toBe('number');

    // the crash surfaced through the hook exactly once, then stays quiet
    const crashCalls = calls.slice(hookCountBeforeCrash).filter((c) => c.instances.some((i) => i.fatalError));
    expect(crashCalls.length).toBe(1);
    const count = calls.length;
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(calls.length).toBe(count);

    // the game loop is dead but the instance (and its error) persist in
    // every later heartbeat — surfaces opening late still see the crash
    expect(recorder.lastHeartbeat()?.instances[0]?.fatalError?.message).toBe('fatal: boom');
  });
});

describe('fatal game error dialog (panel)', () => {
  let mounted: MountedPanel | undefined;
  let secondFixture: FixtureGame | undefined;

  afterEach(() => {
    secondFixture?.dispose();
    secondFixture = undefined;
    mounted?.dispose();
    mounted = undefined;
  });

  it('auto-opens with the error and stack, stays dismissed, and reopens from the chip', async () => {
    mounted = await mountPanel();
    const { app, fixture } = mounted;

    const dialog = app.shadowRoot!.querySelector<FatalErrorDialog>('fatal-error-dialog')!;
    expect(dialog.open).toBe(false);

    fixture.game.on('preupdate', () => {
      throw new Error('fatal: boom');
    });

    await waitFor(() => dialog.open);
    await waitFor(() => dialog.shadowRoot?.querySelector('.message')?.textContent === 'fatal: boom');
    expect(dialog.shadowRoot!.querySelector('.stack')!.textContent).toContain('fatal: boom');

    // dismiss via the dialog's own sl-hide path
    dialog.shadowRoot!.querySelector('sl-dialog')!.dispatchEvent(new CustomEvent('sl-hide', { bubbles: true, composed: true }));
    await waitFor(() => !dialog.open);

    // the 200ms heartbeat keeps re-reporting the same crash — the dismissed
    // error must not reopen the dialog
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(app.fatalErrorOpen).toBe(false);

    // …but the version-bar chip still surfaces it and reopens on demand
    const chip = app.shadowRoot!.querySelector<HTMLButtonElement>('.fatal-chip');
    expect(chip).toBeTruthy();
    chip!.click();
    await waitFor(() => dialog.open);
    expect(app.fatalError?.message).toBe('fatal: boom');
  });

  it('re-arms after navigation: a dismissed error never suppresses the next crash', async () => {
    mounted = await mountPanel();
    const { app } = mounted;

    mounted.fixture.game.on('preupdate', () => {
      throw new Error('fatal: boom');
    });
    const dialog = app.shadowRoot!.querySelector<FatalErrorDialog>('fatal-error-dialog')!;
    await waitFor(() => dialog.open);
    dialog.shadowRoot!.querySelector('sl-dialog')!.dispatchEvent(new CustomEvent('sl-hide', { bubbles: true, composed: true }));
    await waitFor(() => !dialog.open);

    // the game goes away — the panel resets and clears the dismissal
    mounted.fixture.dispose();
    await waitFor(() => app.instances.length === 0);
    await app.updateComplete;
    expect(app.shadowRoot!.querySelector('.fatal-chip')).toBeNull();

    // a fresh game on the same page: detected clean first (the recorder
    // re-arms on the new engine object), then it crashes again
    secondFixture = await createFixtureGame();
    await waitFor(() => app.instances.length === 1 && app.instances[0].fatalError === null);
    secondFixture.game.on('preupdate', () => {
      throw new Error('fatal: second crash');
    });

    await waitFor(() => dialog.open);
    await waitFor(() => dialog.shadowRoot?.querySelector('.message')?.textContent === 'fatal: second crash');
  });
});
