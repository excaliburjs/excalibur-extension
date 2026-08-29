import { afterEach, describe, expect, it } from 'vitest';
import { connectFakePanel, postCommand, type FakePanel } from './helpers';
import { createFixtureGame, waitFor, type FixtureGame } from '../fixtures/game';

describe('local driver connection', () => {
  let fixture: FixtureGame | undefined;
  let panel: FakePanel | undefined;

  afterEach(() => {
    panel?.dispose();
    panel = undefined;
    fixture?.dispose();
    fixture = undefined;
  });

  it('sends ex-debug:init immediately on connect', async () => {
    fixture = await createFixtureGame();
    panel = connectFakePanel();
    const activePanel = panel;
    await waitFor(() => activePanel.received.some((message) => message.name === 'ex-debug:init'));
    expect(panel.received[0].name).toBe('ex-debug:init');
  });

  it('heartbeats with the detected instance and game state', async () => {
    fixture = await createFixtureGame();
    panel = connectFakePanel();
    const activePanel = panel;
    const heartbeat = await waitFor(() => {
      const hb = activePanel.lastHeartbeat();
      return hb && hb.instances.length > 0 ? hb : undefined;
    });

    expect(heartbeat.instances).toHaveLength(1);
    expect(heartbeat.instances[0].frameId).toBe(0);
    expect(heartbeat.selectedFrameId).toBe(0);

    const data = panel.lastData();
    expect(data.version).toBeTruthy();
    expect(data.currentScene).toBeTruthy();
    const names = data.entities.map((entity: { name: string }) => entity.name);
    expect(names).toContain('hero');
    expect(names).toContain('shaded');
    expect(data.stats).toBeTruthy();
  });

  it('applies debug settings from ex-debug:update-debug on the next tick', async () => {
    fixture = await createFixtureGame();
    panel = connectFakePanel();
    const game = fixture.game;

    expect(game.debug.entity.showName).toBe(false);
    postCommand(panel, 'ex-debug:update-debug', { debug: { showNames: true } });
    await waitFor(() => game.debug.entity.showName === true);
    expect(game.debug.entity.showName).toBe(true);
  });

  it('does not clobber game-enabled debug drawing (toggleDebug tri-state)', async () => {
    fixture = await createFixtureGame();
    const game = fixture.game;
    game.toggleDebug();
    expect(game.isDebug).toBe(true);

    panel = connectFakePanel();
    const activePanel = panel;
    await waitFor(() => activePanel.lastHeartbeat());
    // several ticks with default settings must not turn the overlay off
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(game.isDebug).toBe(true);
  });

  it('reports zero instances once the game global is gone', async () => {
    fixture = await createFixtureGame();
    panel = connectFakePanel();
    const activePanel = panel;
    await waitFor(() => activePanel.lastHeartbeat()?.instances.length === 1);

    delete (window as { ___EXCALIBUR_DEVTOOL?: unknown }).___EXCALIBUR_DEVTOOL;
    await waitFor(() => activePanel.lastHeartbeat()?.instances.length === 0);
    const heartbeat = panel.lastHeartbeat()!;
    expect(heartbeat.selectedFrameId).toBeNull();
    expect(heartbeat.data).toBeNull();
  });

  it('stops heartbeating after disconnect', async () => {
    fixture = await createFixtureGame();
    panel = connectFakePanel();
    const activePanel = panel;
    await waitFor(() => activePanel.lastHeartbeat());

    panel.dispose();
    const count = panel.received.length;
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(panel.received.length).toBe(count);
    panel = undefined;
  });
});
