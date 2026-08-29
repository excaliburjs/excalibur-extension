import { afterEach, describe, expect, it } from 'vitest';
import { connectFakePanel, postCommand, type FakePanel } from './helpers';
import { createFixtureGame, waitFor, type FixtureGame } from '../fixtures/game';
import type { MaterialDetailEvent, PipelineDetailEvent } from '../../src/protocol';
import type { FramebufferCapture, PipelineDetail } from '../../src/components/pipeline-view';

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

  it('summarizes the pipeline material passes in the heartbeat', async () => {
    const { panel: activePanel } = await bootWithMaterials();
    // wait until the pass shaders have compiled (first draw of the actor)
    const pipelined = await waitFor(() => {
      const data = activePanel.lastData();
      const summary = data?.materials?.list?.find((material: { name: string }) => material.name === 'pipelined');
      return summary?.pipeline?.passes?.[0]?.compiled ? summary : undefined;
    });

    expect(pipelined.pipeline.opaque).toBe(false);
    expect(pipelined.pipeline.passes).toHaveLength(2);
    const pass0 = pipelined.pipeline.passes[0];
    expect(pass0.scale).toBe(1);
    const uniformNames = pass0.uniforms.map((uniform: { name: string }) => uniform.name);
    expect(uniformNames).toContain('u_strength');
    const strength = pass0.uniforms.find((uniform: { name: string }) => uniform.name === 'u_strength');
    expect(strength.value).toBe(1);
    expect(strength.editable).toBe(true);
    // convention uniforms reflect as built-in, not editable
    const image = pass0.uniforms.find((uniform: { name: string }) => uniform.name === 'u_image');
    expect(image?.builtIn).toBe(true);
  });

  it('lists postprocessors with kind classification in the heartbeat', async () => {
    const { panel: activePanel } = await bootWithMaterials();
    const postprocessors = await waitFor(() => {
      const data = activePanel.lastData();
      return data?.postprocessors?.list?.length >= 2 ? data.postprocessors : undefined;
    });

    const ripple = postprocessors.list.find((pp: { name: string }) => pp.name === 'ripple');
    expect(ripple).toBeTruthy();
    expect(ripple.kind).toBe('pipeline');
    expect(ripple.pipeline.passes).toHaveLength(1);
    expect(typeof ripple.id).toBe('number');
    expect(ripple.key).toBe(`ripple#${ripple.id}`);

    const legacy = postprocessors.list.find((pp: { name: string }) => pp.name === 'FixtureLegacyPostProcessor');
    expect(legacy).toBeTruthy();
    expect(legacy.kind).toBe('legacy');
    expect(legacy.pipeline).toBeNull();
    expect(legacy.compiled).toBe(true);
  });

  /**
   * Posts ex-debug:get-pipeline-detail and waits for the matching reply,
   * keyed so parallel requests in one test can't cross wires.
   */
  function fetchPipelineDetail(
    activePanel: FakePanel,
    query: {
      kind: 'material' | 'postprocessor';
      ownerId: number;
      ownerName: string;
      key: string;
      includeSources: boolean;
      includeFramebuffers: boolean;
    }
  ): Promise<PipelineDetail> {
    postCommand(activePanel, 'ex-debug:get-pipeline-detail', { query });
    return waitFor(() => {
      for (const message of activePanel.received) {
        if (message.name === 'ex-debug:pipeline-detail' && (message as PipelineDetailEvent).data) {
          const detail = JSON.parse((message as PipelineDetailEvent).data!) as PipelineDetail | null;
          if (detail?.key === query.key) {
            return detail;
          }
        }
      }
      return undefined;
    });
  }

  it('returns pass sources and framebuffer captures for a pipeline material', async () => {
    const { panel: activePanel } = await bootWithMaterials();
    const pipelined = await waitFor(() => {
      const data = activePanel.lastData();
      const summary = data?.materials?.list?.find((material: { name: string }) => material.name === 'pipelined');
      // wait for the first draw so seed/intermediate/output framebuffers exist
      return summary?.pipeline?.passes?.[0]?.compiled ? summary : undefined;
    });

    const detail = await fetchPipelineDetail(activePanel, {
      kind: 'material',
      ownerId: pipelined.id,
      ownerName: 'pipelined',
      key: `mat:${pipelined.key}`,
      includeSources: true,
      includeFramebuffers: true
    });

    expect(detail.kind).toBe('material');
    expect(detail.passes).toHaveLength(2);
    expect(detail.passes![0].fragmentSource).toContain('u_strength');

    const stages = detail.framebuffers!.map((fb: FramebufferCapture) => fb.stage);
    expect(stages).toContain('seed');
    expect(stages).toContain('intermediate');
    expect(stages).toContain('output');
    const intermediate = detail.framebuffers!.find((fb: FramebufferCapture) => fb.stage === 'intermediate');
    expect(intermediate!.passIndex).toBe(0);
    for (const fb of detail.framebuffers!) {
      expect(fb.dataUrl, `${fb.stage} capture`).toMatch(/^data:image/);
      expect(fb.width).toBeGreaterThan(0);
    }
  });

  it('omits sources on a framebuffers-only refresh', async () => {
    const { panel: activePanel } = await bootWithMaterials();
    const pipelined = await waitFor(() => {
      const data = activePanel.lastData();
      const summary = data?.materials?.list?.find((material: { name: string }) => material.name === 'pipelined');
      return summary?.pipeline?.passes?.[0]?.compiled ? summary : undefined;
    });

    const detail = await fetchPipelineDetail(activePanel, {
      kind: 'material',
      ownerId: pipelined.id,
      ownerName: 'pipelined',
      key: `mat:${pipelined.key}:refresh`,
      includeSources: false,
      includeFramebuffers: true
    });

    expect(detail.passes).toBeUndefined();
    expect(detail.framebuffers!.length).toBeGreaterThan(0);
    expect(typeof detail.capturedAt).toBe('number');
  });

  it('returns pipeline detail for a pipeline postprocessor and legacy detail for a getShader one', async () => {
    const { panel: activePanel } = await bootWithMaterials();
    const postprocessors = await waitFor(() => {
      const data = activePanel.lastData();
      return data?.postprocessors?.list?.length >= 2 ? data.postprocessors : undefined;
    });

    const ripple = postprocessors.list.find((pp: { name: string }) => pp.name === 'ripple');
    const rippleDetail = await fetchPipelineDetail(activePanel, {
      kind: 'postprocessor',
      ownerId: ripple.id,
      ownerName: ripple.name,
      key: `pp:${ripple.key}`,
      includeSources: true,
      includeFramebuffers: true
    });
    expect(rippleDetail.legacy).toBeUndefined();
    expect(rippleDetail.passes).toHaveLength(1);
    expect(rippleDetail.passes![0].fragmentSource).toContain('u_wobble');
    // the single pass writes straight to the destination, so the only
    // capture is the postprocessor's ping-pong output target
    const rippleStages = rippleDetail.framebuffers!.map((fb: FramebufferCapture) => fb.stage);
    expect(rippleStages).toContain('output');

    const legacy = postprocessors.list.find((pp: { name: string }) => pp.name === 'FixtureLegacyPostProcessor');
    const legacyDetail = await fetchPipelineDetail(activePanel, {
      kind: 'postprocessor',
      ownerId: legacy.id,
      ownerName: legacy.name,
      key: `pp:${legacy.key}`,
      includeSources: true,
      includeFramebuffers: false
    });
    expect(legacyDetail.legacy).toBe(true);
    expect(legacyDetail.passes).toHaveLength(1);
    expect(legacyDetail.passes![0].fragmentSource).toContain('u_image');
  });

  it('writes a pass uniform into the live pipeline material', async () => {
    const { fixture: activeFixture, panel: activePanel } = await bootWithMaterials();
    const pipelined = await waitFor(() => {
      const data = activePanel.lastData();
      return data?.materials?.list?.find((material: { name: string }) => material.name === 'pipelined');
    });

    postCommand(activePanel, 'ex-debug:update-pass-uniform', {
      update: {
        ownerKind: 'material',
        ownerId: pipelined.id,
        ownerName: 'pipelined',
        passIndex: 0,
        uniformName: 'u_strength',
        valueKind: 'float',
        value: 2
      }
    });
    await waitFor(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pipeline = activeFixture.pipelineMaterial.pipeline as any;
      return pipeline.passes[0].uniforms.u_strength === 2;
    });
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
