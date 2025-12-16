import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { colors } from '../colors';
import { common } from '../common';
import { SlChangeEvent, SlSwitch, SlSelect } from '@shoelace-style/shoelace';
import { PhysicsConfig } from '../@types/excalibur';

declare module "../@types/excalibur" {
  interface PhysicsConfig {
    integration?: {
      onScreenOnly: boolean;
    }
  }
}

export interface Physics {
  enabled: boolean;
  maxFps: number | null;
  fixedUpdateFps: number | undefined;
  fixedUpdateTimestep: number | null;
  gravity: { _x: number; _y: number; };
  config: PhysicsConfig;
}
export const DefaultPhysicsSettings: Physics = {
  maxFps: 0,
  enabled: false,
  fixedUpdateFps: 0,
  fixedUpdateTimestep: 0,
  gravity: { _x: 0, _y: 0 },
  config: {}
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

      sl-switch, sl-select, sl-range, sl-checkbox {
        margin-top: 15px;
        margin-bottom: 15px;
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
    config: {} as PhysicsConfig
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


  settingChangeHandler<TObj extends object, TSetting extends keyof TObj>(settingObj: TObj, setting: TSetting) {
    return (
      evt: SlChangeEvent
    ) => {
      if (settingObj[setting]) {
        settingObj[setting] = (evt.target as any).value ?? !!(evt.target as SlSwitch).checked;
        this.dispatchSettingsChange();
      }
    };
  }

  getGeneralPhysics() {
    return html`
    <div class="row section">
      <div class="widget">
        <div class="form-row"><label>Max FPS: </label><span id="max-fps">${this.settings.maxFps || Number.POSITIVE_INFINITY}</span></div>
        <div class="form-row"><label>Fixed Update FPS*: </label><span id="fixed-update-fps">${this.settings.fixedUpdateFps?.toFixed(2) || 'Not Set'}</span></div>
        <div class="form-row"><label>Fixed Update TimeStep*: </label><span id="fixed-update-timestep">${this.settings.fixedUpdateTimestep?.toFixed(2) || 'Not Set'}</span></div>
        <div class="form-row"><label>Gravity X: </label><span id="gravity-x">${this.settings.gravity._x}</span></div>
        <div class="form-row"><label>Gravity Y: </label><span id="gravity-y">${this.settings.gravity._y}</span></div>
        <br>
        <label>* Fixed update helps with stable physics simulations</label>
      </div>
    </div>
    `
  }

  getCommonSettings() {
    return html`
    <div class="row section">
      <div class="widget">
        <div>
          <sl-switch
            id="enable-physics"
            .checked=${this.settings.config.enabled ?? false}
            @sl-change=${this.settingChangeHandler(this.settings.config, 'enabled')}
          ></sl-switch>
          <label for="enable-physics">Enable Physics*</label>
        </div>

        <div>
          <sl-switch
            id="integration"
            .checked=${this.settings.config.integration!.onScreenOnly ?? false}
            @sl-change=${this.settingChangeHandler(this.settings.config.integration!, 'onScreenOnly')}
          ></sl-switch>
          <label for="integration">On Screen Integration Only**</label>
        </div>

        <label>* For perf, disable on games that don't need physics</label>
        <br>
        <label>** For perf, will only integration actors onscreen</label>
      </div>
    </div>

    <h2>Collision Detection</h2>
    <div class="row section">
      <div class="widget">
        <label for="substep">Simulation Sub Steps: ${this.settings.config?.substep ?? 1}</label>
        <sl-range 
          id="substep" 
          help-text="Splits each physics process into steps, helps with tunneling and collision quality"  
          min="1"
          max="10"
          step="1"
          .value=${this.settings.config?.substep ?? 1}
          @sl-change=${this.settingChangeHandler(this.settings.config, 'substep')}
        ></sl-range>

        <label for="spatial-partition">Sparse Hash Grid</label>
        <sl-select id="spatial-partition"
          .value=${this.settings.config.spatialPartition} 
          @sl-change=${this.settingChangeHandler(this.settings.config, 'spatialPartition')}>
          <sl-option id="sparse-hash-grid" value="sparse-hash-grid">Sparse Hash Grid</sl-option>
          <sl-option id="dynamic-tree" value="dynamic-tree">Dynamic Tree (deprecated)</sl-option>
        </sl-select>

        <label for="hash-grid-size">Hash Grid Size: ${this.settings.config.sparseHashGrid?.size ?? 100}</label>
        <sl-range 
          id="hash-grid-size" 
          help-text="Size of grid cells, a good size is the average dimension of colliders" 
          min="10"
          max="500"
          step="10"
          .value=${this.settings.config.sparseHashGrid?.size ?? 100}
          @sl-change=${this.settingChangeHandler(this.settings.config!.sparseHashGrid!, 'size')}
        ></sl-range>

      </div>
    </div>


    <h2>Contact Solver</h2>
    <div class="row section">
      <div class="widget">
        <label for="physics-solver">Physics Solver</label>
        <sl-select id="physics-solver" 
          .value=${this.settings.config.solver} 
          @sl-change=${this.settingChangeHandler(this.settings.config, 'solver')}>
          <sl-option id="arcade" value="arcade">Arcade</sl-option>
          <sl-option id="realistic" value="realistic">Realistic</sl-option>
        </sl-select>
      </div>
    </div>
    `;
  }

  getArcadeSettings() {
    return html`
    <div class="row section">
      <div class="widget">
        <label for="arcade-bias">Contact Solve Bias</label>
        <sl-select id="arcade-bias" value="none"
          .value=${this.settings.config.arcade?.contactSolveBias ?? 'none'}
          @sl-change=${this.settingChangeHandler(this.settings.config.arcade!, 'contactSolveBias')}
        >
          <sl-option id="none" value="none">None</sl-option>
          <sl-option id="vertical-first" value="vertical-first">Vertical First</sl-option>
          <sl-option id="horizontal-first" value="horizontal-first">Horizontal First</sl-option>
        </sl-select>
      </div>
    </div>
    `;
  }

  getRealisticSettings() {
    return html`
    <div class="row section">
      <div class="widget">
        <label for="arcade-bias">Contact Solve Bias</label>
        <sl-select id="realistic-bias" value="none"
          .value=${this.settings.config.realistic?.contactSolveBias ?? 'none'}
          @sl-change=${this.settingChangeHandler(this.settings.config.realistic!, 'contactSolveBias')}
        >
          <sl-option id="none" value="none">None</sl-option>
          <sl-option id="vertical-first" value="vertical-first">Vertical First</sl-option>
          <sl-option id="horizontal-first" value="horizontal-first">Horizontal First</sl-option>
        </sl-select>
      </div>
    </div>
    <h2>Realistic Constraint Solver</h2>
    <div class="row section">
      <div class="widget">
        <sl-checkbox
          .checked=${this.settings.config.realistic?.warmStart ?? true}
          @sl-change=${this.settingChangeHandler(this.settings.config.realistic!, 'warmStart')}
        >Warm Start (improves stacks)</sl-checkbox><br>
        <label for="realistic-position-interations">Position Iterations ${this.settings.config.realistic?.positionIterations}</label>
        <sl-range 
          id="realistic-position-interations" 
          help-text="Solves geometry overlap, increase if things are still overlapping"  
          min="1" 
          max="30" 
          step="1"
          .value=${this.settings.config.realistic?.positionIterations}
          @sl-change=${this.settingChangeHandler(this.settings.config.realistic!, 'positionIterations')}
        ></sl-range>

        <label for="realistic-velocity-interations">Velocity Iterations ${this.settings.config.realistic?.velocityIterations}</label>
        <sl-range 
          id="realistic-velocity-interations" 
          help-text="Solves friction and bouncing, increase for higher quality bounces/sliding" 
          min="1" 
          max="30" 
          step="1"
          .value=${this.settings.config.realistic?.velocityIterations}
          @sl-change=${this.settingChangeHandler(this.settings.config.realistic!, 'velocityIterations')}
        ></sl-range>
      </div>
    </div>

    <h2>Realistic Bodies</h2>
    <div class="row section">
      <div class="widget">
        <sl-checkbox
          .checked=${this.settings.config.bodies?.canSleepByDefault ?? true}
          @sl-change=${this.settingChangeHandler(this.settings.config.bodies!, 'canSleepByDefault')}
        >Can Sleep By Default</sl-checkbox><br>
        <label for="default-mass">Default Mass: ${this.settings.config.bodies?.defaultMass}</label>
        <sl-range 
          id="default-mass" 
          help-text="Default Mass of the object if none is provided"  
          min="1" 
          max="100" 
          step="1"
          .value=${this.settings.config.bodies?.defaultMass}
          @sl-change=${this.settingChangeHandler(this.settings.config.bodies!, 'defaultMass')}
        ></sl-range>

        <label for="sleep-bias">Sleep Bias ${this.settings.config.bodies?.sleepBias}</label>
        <sl-range 
          id="sleep-bias" 
          help-text="TODO Sleep Bias Explaination" 
          min=".1" 
          max="1" 
          step=".05"
          .value=${this.settings.config.bodies?.sleepBias}
          @sl-change=${this.settingChangeHandler(this.settings.config.bodies!, 'sleepBias')}
        ></sl-range>


        <label for="sleep-epsilon">Sleep Epsilon ${this.settings.config.bodies?.sleepEpsilon}</label>
        <sl-range 
          id="sleep-epsilon" 
          help-text="TODO Sleep EpsilonExplaination" 
          min=".01" 
          max=".1" 
          step=".01"
          .value=${this.settings.config.bodies?.sleepEpsilon}
          @sl-change=${this.settingChangeHandler(this.settings.config.bodies!, 'sleepEpsilon')}
        ></sl-range>


        <label for="wake-threshold">Wake Threshold ${this.settings.config.bodies?.wakeThreshold}</label>
        <sl-range 
          id="wake-threshold" 
          help-text="TODO Wake Threshhold Explaination" 
          min=".1" 
          max=".5" 
          step=".01"
          .value=${this.settings.config.bodies?.wakeThreshold}
          @sl-change=${this.settingChangeHandler(this.settings.config.bodies!, 'wakeThreshold')}
        ></sl-range>
      </div>
    </div>

    `;

  }

  render() {
    return html`

<div class="row">
  <div class="widget">
    <h2>Physics Simulation Settings</h2>
    <div class="physics-settings">
      <form>
        ${ this.getGeneralPhysics() }

        ${ this.getCommonSettings() }
        ${
           this.settings.config?.solver === 'arcade' ?
           this.getArcadeSettings() :
           this.getRealisticSettings()
        }
      </form>
    </div>
  </div>
</div>
    `;
  }
}
