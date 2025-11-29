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
  gravity: { _x: 0, _y: 0 },
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
    gravity: { _x: 0, _y: 0 },
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
              <label for="substep">Simulation Sub Steps: ${1}</label>
							<sl-range 
                id="substep" 
                help-text="Splits each physics process into steps, helps with tunneling and collision quality"  
                min="1"
                max="10"
                step="1"
                value="1"
              ></sl-range>

              <label for="physics-solver">Physics Solver</label>
              <sl-select id="physics-solver" value=${this.settings.solverStrategy} @sl-change=${this.physicsSolverInputHandler()}>
                <sl-option id="arcade" value="arcade">Arcade</sl-option>
                <sl-option id="realistic" value="realistic">Realistic</sl-option>
              </sl-select>

							<!-- if realistic -->
              <sl-checkbox>Warm Start (improves stacks)</sl-checkbox><br>
              <label for="realistic-position-interations">Position Iterations ${3}</label>
							<sl-range 
                id="realistic-position-interations" 
                help-text="Solves geometry overlap, increase if things are still overlapping"  
                min="1" 
                max="30" 
                step="1"
                value="3"
              ></sl-range>

              <label for="realistic-velocity-interations">Velocity Iterations ${8}</label>
							<sl-range 
                id="realistic-velocity-interations" 
                help-text="Solves friction and bouncing, increase for higher quality bounces/sliding" 
                min="1" 
                max="30" 
                step="1"
                value="8"
              ></sl-range>
              <!-- if either -->

              <label for="arcade-bias">Contact Solve Bias</label>
              <sl-select id="arcade-bias" value="none">
                <sl-option id="none" value="none">None</sl-option>
                <sl-option id="vertical-first" value="vertical-first">Vertical First</sl-option>
                <sl-option id="horizontal-first" value="horizontal-first">Horizontal First</sl-option>
              </sl-select>


              <label for="spatial-partition">Sparse Hash Grid</label>
              <sl-select id="spatial-partition" value="sparse-hash-grid">
                <sl-option id="sparse-hash-grid" value="sparse-hash-grid">Sparse Has Grid</sl-option>
                <sl-option id="dynamic-tree" value="dynamic-tree">Dynamic Tree (deprecated)</sl-option>
              </sl-select>

              <label for="hash-grid-size">Hash Grid Size</label>
							<sl-range 
                id="hash-grid-size" 
                help-text="Size of grid cells, a good size is the average dimension of colliders" 
                min="10"
                max="500"
                step="10"
                value="100"
              ></sl-range>

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
