import '../../src/components/app-main';
import type { App } from '../../src/components/app-main';
import { createLocalTransport } from '../../src/embedded/local-driver';
import type { EventDispatchEvents, HeartbeatMessage } from '../../src/protocol';
import { createFixtureGame, waitFor, type FixtureGame } from '../fixtures/game';

export interface MountedPanel {
  fixture: FixtureGame;
  app: App;
  dispose(): void;
}

/**
 * Boots the fixture game and mounts the full panel (<app-main>) against the
 * in-page local driver — the embedded-build wiring, minus the host iframe.
 */
export async function mountPanel(): Promise<MountedPanel> {
  const fixture = await createFixtureGame();
  const app = document.createElement('app-main') as App;
  app.transportFactory = () => createLocalTransport();
  document.body.appendChild(app);
  await waitFor(() => app.hasReceivedHeartbeat);
  return {
    fixture,
    app,
    dispose: () => {
      app.remove();
      fixture.dispose();
    }
  };
}

export interface FakePanel {
  received: EventDispatchEvents[];
  post(message: object): void;
  /** Most recent heartbeat, or undefined before the first tick. */
  lastHeartbeat(): HeartbeatMessage | undefined;
  /** Parsed `data` of the most recent heartbeat (null when no game). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lastData(): any;
  dispose(): void;
}

/**
 * Connects a protocol-level fake panel to the local driver: records every
 * inbound message and posts raw commands. Used to test the driver without
 * any UI in the way.
 */
export function connectFakePanel(): FakePanel {
  const transport = createLocalTransport();
  const received: EventDispatchEvents[] = [];
  transport.onMessage((message) => received.push(message));
  const lastHeartbeat = () => [...received].reverse().find((message): message is HeartbeatMessage => message.name === 'ex-debug:heartbeat');
  return {
    received,
    post: (message) => transport.post(message),
    lastHeartbeat,
    lastData: () => {
      const heartbeat = lastHeartbeat();
      return heartbeat?.data ? JSON.parse(heartbeat.data) : null;
    },
    dispose: () => transport.disconnect()
  };
}

/**
 * Posts an `ex-debug:command`; the transport stamps tabId.
 */
export function postCommand(panel: FakePanel, dispatch: string, payload: Record<string, unknown> = {}): void {
  panel.post({ name: 'ex-debug:command', dispatch, ...payload });
}
