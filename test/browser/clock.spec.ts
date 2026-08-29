import { afterEach, describe, it } from 'vitest';
import * as ex from 'excalibur';
import { connectFakePanel, postCommand, type FakePanel } from './helpers';
import { createFixtureGame, waitFor, type FixtureGame } from '../fixtures/game';

describe('clock commands', () => {
  let fixture: FixtureGame | undefined;
  let panel: FakePanel | undefined;

  afterEach(() => {
    panel?.dispose();
    panel = undefined;
    fixture?.dispose();
    fixture = undefined;
  });

  it('toggle-test-clock swaps to a TestClock and back', async () => {
    fixture = await createFixtureGame();
    panel = connectFakePanel();
    const game = fixture.game;

    postCommand(panel, 'ex-debug:toggle-test-clock');
    await waitFor(() => game.clock instanceof ex.TestClock);

    postCommand(panel, 'ex-debug:toggle-test-clock');
    await waitFor(() => !(game.clock instanceof ex.TestClock));
  });

  it('stop-clock and start-clock control the running state', async () => {
    fixture = await createFixtureGame();
    panel = connectFakePanel();
    const game = fixture.game;

    await waitFor(() => game.clock.isRunning());
    postCommand(panel, 'ex-debug:stop-clock');
    await waitFor(() => !game.clock.isRunning());

    postCommand(panel, 'ex-debug:start-clock');
    await waitFor(() => game.clock.isRunning());
  });

  it('step-clock advances a stopped test clock', async () => {
    fixture = await createFixtureGame();
    panel = connectFakePanel();
    const game = fixture.game;

    postCommand(panel, 'ex-debug:toggle-test-clock');
    await waitFor(() => game.clock instanceof ex.TestClock);

    const before = game.currentScene.engine.stats.currFrame.id;
    postCommand(panel, 'ex-debug:step-clock', { stepMs: 16 });
    await waitFor(() => game.currentScene.engine.stats.currFrame.id > before);
  });
});
