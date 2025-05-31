import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { colors } from '../colors';
import { common } from '../common';
import { SlChangeEvent, SlSwitch, SlSelect } from '@shoelace-style/shoelace';

export type PhysicsSolverStrategy = 'arcade' | 'realistic';

export interface Physics {
  enabled: boolean;
  maxFps: number | null;
  fixedUpdateFps: number | undefined;
  fixedUpdateTimestep: number | null;
  gravity: { _x: number; _y: number; };
  solverStrategy: PhysicsSolverStrategy;
}
export const DefaultPhysicsSettings: Physics = {
  maxFps: 0,
  enabled: false,
  fixedUpdateFps: 0,
  fixedUpdateTimestep: 0,
  gravity: {_x: 0, _y: 0},
  solverStrategy: 'arcade',
};

/**
 * @event physics-settings-change - Emitted when settings change
 */
@customElement('physics-settings')
export class PhysicsSettings extends LitElement {
  static styles = [
    colors,
    common,
    css`
      :host {
        display: block;
      }

      sl-select {
        margin-top: 15px;
      }
    `
  ];

  @property({ type: Object })
  settings: Physics = {
    maxFps: 0,
    enabled: false,
    fixedUpdateFps: 0,
    fixedUpdateTimestep: 0,
    gravity: {_x: 0, _y: 0},
    solverStrategy: 'arcade',
  };

  updateSettings(settings: Physics) {
    this.settings = settings;
    this.requestUpdate();
  }

  dispatchSettingsChange() {
    this.dispatchEvent(
      new CustomEvent<Physics>('physics-settings-change', {
        detail: this.settings,
        bubbles: true,
        composed: true
      })
    );
  }

  settingSwitchChangeHandler(setting: keyof Physics) {
    return (evt: SlChangeEvent) => {
      if (this.settings && typeof this.settings[setting] === 'boolean') {
        (this.settings[setting] as boolean) = !!(evt.target as SlSwitch).checked;
        this.dispatchSettingsChange();
      }
    };
  }

  physicsSolverInputHandler() {
    return (evt: SlChangeEvent) => {
      this.settings.solverStrategy = (evt.target as SlSelect).value as PhysicsSolverStrategy;
      this.dispatchSettingsChange();
    };
  }

  render() {
    return html`
      <div class="physics-settings">
        <form>
          <div class="row section">
            <div class="widget">
              <sl-switch
                id="enable-physics"
                .checked=${this.settings.enabled ?? false}
                @sl-change=${this.settingSwitchChangeHandler('enabled')}
              ></sl-switch>
              <label for="enable-physics">Enable Physics</label>
            </div>
          </div>

          <div class="row section">
            <div class="widget">
              <label for="physics-solver">Physics Solver</label>
              <sl-select id="physics-solver" value=${this.settings.solverStrategy} @sl-change=${this.physicsSolverInputHandler()}>
                <sl-option id="arcade" value="arcade">Arcade</sl-option>
                <sl-option id="realistic" value="realistic">Realistic</sl-option>
              </sl-select>
            </div>
          </div>

          <div class="row section">
            <div class="widget">
              <div>Max FPS: <span id="max-fps">${this.settings.maxFps || Number.POSITIVE_INFINITY}</span></div>
              <div>Fixed Update FPS: <span id="fixed-update-fps">${this.settings.fixedUpdateFps || 'Not Set'}</span></div>
              <div>Fixed Update TimeStep: <span id="fixed-update-timestep">${this.settings.fixedUpdateTimestep || 'Not Set'}</span></div>
              <div>Gravity X: <span id="gravity-x">${this.settings.gravity._x}</span></div>
              <div>Gravity Y: <span id="gravity-y">${this.settings.gravity._y}</span></div>
            </div>
          </div>
        </form>
      </div>
    `;
  }
}
