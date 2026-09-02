import { afterEach, describe, expect, it } from 'vitest';
import { createConnection, type ConnectionHandle, type DriverPort } from '../../src/driver/connection';
import { directExecutor } from '../../src/embedded/local-driver';
import '../../src/components/app-main';
import type { App } from '../../src/components/app-main';
import type { PanelTransport } from '../../src/panel-transport/types';
import type { EventDispatchEvents, ExInstance, HeartbeatMessage } from '../../src/protocol';
import { createFixtureGame, waitFor, type FixtureGame } from '../fixtures/game';

/**
 * A DriverPort that records everything the connection posts and lets the
 * test act as the panel side (delivering raw messages, reading heartbeats).
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
 * The popup's debug-toggle path, minus the extension APIs: the background
 * flips the page, then calls ConnectionHandle.externalDebugToggle on every
 * connection inspecting that tab.
 */
describe('popup-driven debug toggle (connection coordination)', () => {
  let fixture: FixtureGame | undefined;
  let handle: ConnectionHandle | undefined;

  afterEach(() => {
    handle?.dispose();
    handle = undefined;
    fixture?.dispose();
    fixture = undefined;
  });

  it('externalDebugToggle syncs the panel and the 200ms tick adopts the value', async () => {
    fixture = await createFixtureGame();
    const recorder = createRecordingPort();
    handle = createConnection(recorder.port, directExecutor);

    recorder.deliver({ name: 'ex-debug:hello', tabId: 0 });
    const heartbeat = await waitFor(() => (recorder.lastHeartbeat()?.data != null ? recorder.lastHeartbeat() : undefined));
    const before = !!(JSON.parse(heartbeat.data as string) as { isDebug: boolean }).isDebug;

    handle.externalDebugToggle(!before);

    // the panel is told immediately…
    expect(recorder.posted.some((m) => (m as { name?: string }).name === 'ex-debug:debug-toggled')).toBe(true);
    // …and the heartbeat keeps asserting the new value instead of clobbering it
    await waitFor(() => {
      const hb = recorder.lastHeartbeat();
      return hb?.data ? !!(JSON.parse(hb.data) as { isDebug: boolean }).isDebug === !before : false;
    });
    expect(handle.getTabId()).toBe(0);
    expect(fixture.game.isDebug).toBe(!before);
  });

  it('reports instance changes through the onInstancesChanged hook (badge path)', async () => {
    fixture = await createFixtureGame();
    const calls: Array<{ tabId: number | null; instances: ExInstance[] }> = [];
    const recorder = createRecordingPort();
    handle = createConnection(recorder.port, directExecutor, {
      onInstancesChanged: (tabId, instances) => calls.push({ tabId, instances })
    });

    recorder.deliver({ name: 'ex-debug:hello', tabId: 0 });
    await waitFor(() => (calls.length > 0 && calls[0].instances.length > 0 ? calls[0] : undefined));
    expect(calls[0].tabId).toBe(0);
    expect(calls[0].instances[0].isDebug).toBe(false);

    // steady state: the hook must not fire again while nothing changes
    const count = calls.length;
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(calls.length).toBe(count);
  });
});

/**
 * The panel side of the same path: what the panel does when the driver
 * pushes ex-debug:debug-toggled (see protocol.ts).
 */
describe('panel adoption of popup toggles', () => {
  let fixture: FixtureGame | undefined;
  let app: App | undefined;

  afterEach(() => {
    app?.remove();
    app = undefined;
    fixture?.dispose();
    fixture = undefined;
  });

  it('adopts ex-debug:debug-toggled without giving up user authority', async () => {
    fixture = await createFixtureGame();
    let panelCb: ((message: EventDispatchEvents) => void) | undefined;
    const transport: PanelTransport = {
      post: () => {
        // commands go nowhere; this test drives the panel side directly
      },
      onMessage: (cb) => {
        panelCb = cb;
      },
      onDisconnect: () => {
        // never fires in this test
      },
      disconnect: () => {
        panelCb = undefined;
      }
    };
    app = document.createElement('app-main') as App;
    app.transportFactory = () => transport;
    document.body.appendChild(app);
    await app.updateComplete;

    // the user toggles once in the panel → the panel becomes authoritative
    app.toggleDebugDraw();
    expect(app.toggleDebug).toBe(true);

    // a popup-initiated toggle arrives from the driver
    panelCb?.({ name: 'ex-debug:debug-toggled', value: false });
    expect(app.toggleDebug).toBe(false);
  });
});
