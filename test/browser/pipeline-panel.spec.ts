import { afterEach, describe, expect, it } from 'vitest';
import { mountPanel, type MountedPanel } from './helpers';
import { waitFor } from '../fixtures/game';
import type { MaterialsPanel } from '../../src/components/materials-panel';
import type { MaterialDetailView } from '../../src/components/material-detail';
import type { PipelineView } from '../../src/components/pipeline-view';

describe('materials/postprocessors panel UI', () => {
  let mounted: MountedPanel | undefined;

  afterEach(() => {
    mounted?.dispose();
    mounted = undefined;
  });

  /** Mounts the full panel and switches to the Materials/PostProcessors tab. */
  async function openMaterialsTab() {
    mounted = await mountPanel();
    const { app } = mounted;
    await waitFor(() => app.instances.length === 1);
    const tab = await waitFor(() => app.shadowRoot!.querySelector<HTMLElement>('sl-tab[panel="materials"]'));
    tab.click();
    const panel = await waitFor(() => app.shadowRoot!.querySelector<MaterialsPanel>('materials-panel'));
    return { app, panel };
  }

  it('renders both list sections with the fixture items', async () => {
    const { panel } = await openMaterialsTab();
    await waitFor(() => (panel.shadowRoot?.textContent ?? '').includes('pipelined'));
    const text = panel.shadowRoot!.textContent!;
    expect(text).toContain('Post Processors');
    expect(text).toContain('ripple');
    expect(text).toContain('FixtureLegacyPostProcessor');
  });

  it('fetches pipeline detail and renders framebuffer captures for the pipeline material', async () => {
    const { app, panel } = await openMaterialsTab();

    const button = await waitFor(() =>
      Array.from(panel.shadowRoot!.querySelectorAll('button')).find((b) => b.textContent?.includes('pipelined'))
    );
    button.click();

    const detailKey = await waitFor(() => {
      const summary = app.materials.list.find((m) => m.name === 'pipelined');
      return summary ? `mat:${summary.key}` : undefined;
    });
    // sources arrive with the first fetch, captures ride the same reply
    await waitFor(() => app.pipelineDetails[detailKey]?.passes?.length === 2, 5000);
    await waitFor(() => (app.pipelineDetails[detailKey]?.framebuffers?.length ?? 0) > 0, 5000);

    const materialDetail = await waitFor(() => panel.shadowRoot!.querySelector<MaterialDetailView>('material-detail'));
    const pipelineView = await waitFor(() => materialDetail.shadowRoot?.querySelector<PipelineView>('pipeline-view'));
    await waitFor(() => pipelineView.shadowRoot?.querySelector('.fb img'));
    // pass 0's editable uniform renders in the pass card
    await waitFor(() => (pipelineView.shadowRoot?.textContent ?? '').includes('u_strength'));
  });

  it('selecting the ripple postprocessor renders its pipeline view with the pass source', async () => {
    const { app, panel } = await openMaterialsTab();

    const button = await waitFor(() =>
      Array.from(panel.shadowRoot!.querySelectorAll('button')).find((b) => b.textContent?.includes('ripple'))
    );
    button.click();

    await waitFor(() => Object.keys(app.pipelineDetails).some((key) => key.startsWith('pp:ripple')), 5000);
    const pipelineView = await waitFor(() => panel.shadowRoot!.querySelector<PipelineView>('pipeline-view'));
    await waitFor(() => (pipelineView.shadowRoot?.textContent ?? '').includes('u_wobble'));
  });
});
