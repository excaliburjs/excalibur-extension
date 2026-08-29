import { afterEach, describe, expect, it } from 'vitest';
import type { SlSwitch } from '@shoelace-style/shoelace';
import { mountPanel, type MountedPanel } from './helpers';
import { waitFor } from '../fixtures/game';

describe('embedded panel UI', () => {
  let mounted: MountedPanel | undefined;

  afterEach(() => {
    mounted?.dispose();
    mounted = undefined;
  });

  it('connects, hides the no-game overlay, and renders the version', async () => {
    mounted = await mountPanel();
    const { app } = mounted;

    await waitFor(() => app.instances.length === 1);
    await app.updateComplete;

    expect(app.shadowRoot!.querySelector('no-excalibur-overlay')).toBeNull();
    expect(app.engine.version).toBeTruthy();
  });

  it('lists the fixture entities in the entity list', async () => {
    mounted = await mountPanel();
    const { app } = mounted;

    const entityList = await waitFor(() => app.shadowRoot!.querySelector('entity-list'));
    await waitFor(() => (entityList.shadowRoot?.textContent ?? '').includes('hero'));
    expect(entityList.shadowRoot!.textContent).toContain('shaded');
  });

  it('toggling a debug switch flips the live game debug flag end to end', async () => {
    mounted = await mountPanel();
    const { app, fixture } = mounted;
    const game = fixture.game;

    const debugSettings = await waitFor(() => app.shadowRoot!.querySelector('debug-settings'));
    const showPos = await waitFor(() => debugSettings.shadowRoot?.querySelector<SlSwitch>('#show-pos'));
    expect(game.debug.transform.showPosition).toBe(false);

    showPos.click();

    // panel store → ex-debug:update-debug → next 200ms tick patches the game
    await waitFor(() => game.debug.transform.showPosition === true);
  });

  it('recovers to the overlay when the game disappears', async () => {
    mounted = await mountPanel();
    const { app, fixture } = mounted;

    await waitFor(() => app.instances.length === 1);
    delete (window as { ___EXCALIBUR_DEVTOOL?: unknown }).___EXCALIBUR_DEVTOOL;
    fixture.game.stop();

    await waitFor(() => app.instances.length === 0);
    await app.updateComplete;
    expect(app.shadowRoot!.querySelector('no-excalibur-overlay')).not.toBeNull();
  });
});
