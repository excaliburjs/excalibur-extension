import { afterEach, describe, expect, it } from 'vitest';
import { connectFakePanel, postCommand, type FakePanel } from './helpers';
import { createFixtureGame, waitFor, type FixtureGame } from '../fixtures/game';
import type { MaterialDetailEvent } from '../../src/protocol';

describe('materials commands', () => {
  let fixture: FixtureGame | undefined;
  let panel: FakePanel | undefined;

  afterEach(() => {
    panel?.dispose();
    panel = undefined;
    fixture?.dispose();
    fixture = undefined;
  });

  async function bootWithMaterials() {
    fixture = await createFixtureGame();
    panel = connectFakePanel();
    const activePanel = panel;
    // Heavy material collection only runs while the Materials tab is visible
    postCommand(panel, 'ex-debug:materials-active', { active: true });
    const materials = await waitFor(() => {
      const data = activePanel.lastData();
      return data?.materials?.list?.length ? data.materials : undefined;
    });
    return { fixture, panel, materials };
  }

  it('collects the fixture material into the heartbeat while active', async () => {
    const { materials } = await bootWithMaterials();
    const names = materials.list.map((material: { name: string }) => material.name);
    expect(names).toContain('glow');

    const glow = materials.list.find((material: { name: string }) => material.name === 'glow');
    const uniformNames = glow.uniforms.map((uniform: { name: string }) => uniform.name);
    expect(uniformNames).toContain('u_intensity');
  });

  it('returns shader sources via get-material-detail', async () => {
    const { panel: activePanel, materials } = await bootWithMaterials();
    const glow = materials.list.find((material: { name: string }) => material.name === 'glow');

    postCommand(activePanel, 'ex-debug:get-material-detail', { materialId: glow.id, materialName: 'glow' });
    const reply = await waitFor(() =>
      activePanel.received.find((message): message is MaterialDetailEvent => message.name === 'ex-debug:material-detail')
    );
    const detail = JSON.parse(reply.data!);
    expect(detail.fragmentSource).toContain('u_intensity');
    expect(detail.vertexSource).toBeTruthy();
  });

  it('writes a float uniform into the live material', async () => {
    const { fixture: activeFixture, panel: activePanel, materials } = await bootWithMaterials();
    const glow = materials.list.find((material: { name: string }) => material.name === 'glow');

    postCommand(activePanel, 'ex-debug:update-material-uniform', {
      update: {
        materialId: glow.id,
        materialName: 'glow',
        uniformName: 'u_intensity',
        kind: 'float',
        value: 2.5
      }
    });
    await waitFor(() => activeFixture.material.uniforms.u_intensity === 2.5);
  });
});
