import { afterEach, describe, expect, it } from 'vitest';
import { connectFakePanel, postCommand, type FakePanel } from './helpers';
import { createFixtureGame, waitFor, type FixtureGame } from '../fixtures/game';
import type { InspectedEntity } from '../../src/protocol';

describe('entity inspection commands', () => {
  let fixture: FixtureGame | undefined;
  let panel: FakePanel | undefined;

  afterEach(() => {
    panel?.dispose();
    panel = undefined;
    fixture?.dispose();
    fixture = undefined;
  });

  it('includes the inspected entity with components in the heartbeat', async () => {
    fixture = await createFixtureGame();
    panel = connectFakePanel();
    const activePanel = panel;
    const heroId = fixture.hero.id;

    postCommand(panel, 'ex-debug:inspect-entity', { entityId: heroId });
    const inspected: InspectedEntity = await waitFor(() => {
      const data = activePanel.lastData();
      return data?.inspectedEntity ?? undefined;
    });

    expect(inspected.id).toBe(heroId);
    expect(inspected.name).toBe('hero');
    expect(inspected.components.length).toBeGreaterThan(0);
    const kinds = inspected.components.map((component) => component.kind);
    expect(kinds).toContain('transform');
  });

  it('applies an allowlisted property write to the live entity', async () => {
    fixture = await createFixtureGame();
    panel = connectFakePanel();
    const hero = fixture.hero;

    postCommand(panel, 'ex-debug:update-entity-property', {
      update: {
        entityId: hero.id,
        target: 'transform',
        property: 'pos',
        kind: 'vector',
        value: { x: 42, y: 24 }
      }
    });
    await waitFor(() => hero.pos.x === 42 && hero.pos.y === 24);
  });

  it('kills an entity via ex-debug:kill', async () => {
    fixture = await createFixtureGame();
    panel = connectFakePanel();
    const hero = fixture.hero;

    postCommand(panel, 'ex-debug:kill', { actorId: hero.id });
    await waitFor(() => hero.isKilled());
  });

  it('switches scenes via ex-debug:goto-scene', async () => {
    fixture = await createFixtureGame();
    panel = connectFakePanel();
    const activePanel = panel;
    const game = fixture.game;

    postCommand(panel, 'ex-debug:goto-scene', { sceneName: 'level2' });
    await waitFor(() => game.currentSceneName === 'level2');
    await waitFor(() => activePanel.lastData()?.currentScene === 'level2');
  });
});
