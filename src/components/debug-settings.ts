import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { colors } from '../colors';
import { common } from '../common';
import { SlChangeEvent, SlColorPicker, SlInputEvent, SlSwitch } from '@shoelace-style/shoelace';
import {
  settingsStore,
  settingsSchema,
  hexToColor,
  colorToHex,
  Settings,
  BooleanSettingsKey,
  ColorSettingsKey,
} from '../settings';

// Re-export for backward compatibility
export { Settings, DefaultSettings } from '../settings';

/**
 * @event debug-settings-change - Emitted when settings change
 * @event toggle-debug-draw -  Emitted when toggle debug draw is clicked
 */
@customElement('debug-settings')
export class DebugSettings extends LitElement {
  static styles = [
    colors,
    common,
    css`
      :host {
        display: block;
      }

      .flex {
        display: flex;
        align-items: center;
      }

      sl-button {
        padding-bottom: 10px;
      }

      sl-switch {
        padding-bottom: 10px;
      }
    `
  ];

  override shouldUpdate() {
    return this.isConnected;
  }

  private _unsubscribe: (() => void) | null = null;

  connectedCallback() {
    super.connectedCallback();
    const handler = () => {
      if (!this.isConnected) {
        return;
      }
      this.requestUpdate();
    };
    settingsStore.addEventListener('change', handler);
    this._unsubscribe = () => settingsStore.removeEventListener('change', handler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe?.();
  }

  /**
   * Update settings from external source (e.g., initial load from game state)
   */
  updateSettings(settings: Settings) {
    settingsStore.setAll(settings);
  }

  private _dispatchDebugSettingsChange() {
    this.dispatchEvent(
      new CustomEvent<Settings>('debug-settings-change', {
        detail: settingsStore.getAll(),
        bubbles: true,
        composed: true
      })
    );
  }

  private _dispatchToggleDebugDraw() {
    this.dispatchEvent(
      new CustomEvent('toggle-debug-draw', {
        bubbles: true,
        composed: true
      })
    );
  }

  private _handleSwitchChange(key: BooleanSettingsKey) {
    return (evt: SlChangeEvent) => {
      settingsStore.setBoolean(key, (evt.target as SlSwitch).checked);
      this._dispatchDebugSettingsChange();
    };
  }

  private _handleColorInput(key: ColorSettingsKey) {
    return (evt: SlInputEvent) => {
      settingsStore.setColor(key, hexToColor((evt.target as SlColorPicker).value));
      this._dispatchDebugSettingsChange();
    };
  }

  transformHtml() {
    return html`
    <h2>Transform</h2>
    <div class="section">
      <form>
        <div class="form-row">
          <div>
            <sl-switch
              id="show-pos"
              .checked=${settingsStore.get('showPos')}
              @sl-change=${this._handleSwitchChange('showPos')}
            ></sl-switch>
            <label for="show-pos">${settingsSchema.showPos.label}</label>
          </div>
          <div>
            <sl-switch
              id="show-pos-label"
              .checked=${settingsStore.get('showPosLabel')}
              @sl-change=${this._handleSwitchChange('showPosLabel')}
            ></sl-switch>
            <label for="show-pos-label">Show Coordinates</label>
          </div>
          <div>
            <sl-color-picker
              id="show-pos-color"
              format="hex"
              .noFormatToggle=${true}
              .hoist=${true}
              .value=${colorToHex(settingsStore.get('posColor'))}
              opacity
              @sl-input=${this._handleColorInput('posColor')}>Color</sl-color-picker>
          </div>
        </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-rotation"
              .checked=${settingsStore.get('showRotation')}
              @sl-change=${this._handleSwitchChange('showRotation')}
            ></sl-switch>
            <label for="show-rotation">${settingsSchema.showRotation.label}</label>
          </div>

          <div>
            <sl-color-picker
              id="show-rotation-color"
              format="hex"
              .noFormatToggle=${true}
              .hoist=${true}
              .value=${colorToHex(settingsStore.get('rotationColor'))}
              opacity
              @sl-input=${this._handleColorInput('rotationColor')}>Color</sl-color-picker>
          </div>
        </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-scale"
              .checked=${settingsStore.get('showScale')}
              @sl-change=${this._handleSwitchChange('showScale')}
            ></sl-switch>
            <label for="show-scale">${settingsSchema.showScale.label}</label>
          </div>
          <div>
            <sl-color-picker
              id="show-scale-color"
              format="hex"
              .noFormatToggle=${true}
              .hoist=${true}
              .value=${colorToHex(settingsStore.get('scaleColor'))}
              opacity
              @sl-input=${this._handleColorInput('scaleColor')}>Color</sl-color-picker>
          </div>
        </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-zindex"
              .checked=${settingsStore.get('showZIndex')}
              @sl-change=${this._handleSwitchChange('showZIndex')}
            ></sl-switch>
            <label for="show-zindex">${settingsSchema.showZIndex.label}</label>
          </div>
          <div>
          </div>
        </div>
      </form>
    </div>
    `;
  }

  componentsHtml() {
    return html`
    <h2>Components</h2>
    <div class="section">
      <form>
        <div class="form-row">
          <div>
            <sl-switch
              id="show-graphics-bounds"
              .checked=${settingsStore.get('showGraphicsBounds')}
              @sl-change=${this._handleSwitchChange('showGraphicsBounds')}
            ></sl-switch>
            <label for="show-graphics-bounds">${settingsSchema.showGraphicsBounds.label}</label>
          </div>

          <div>
            <sl-color-picker
              id="graphics-bounds-colors"
              .hoist=${true}
              .value=${colorToHex(settingsStore.get('graphicsBoundsColor'))}
              opacity
              @sl-input=${this._handleColorInput('graphicsBoundsColor')}
              >Color</sl-color-picker
            >
          </div>
        </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-collider-bounds"
              .checked=${settingsStore.get('showColliderBounds')}
              @sl-change=${this._handleSwitchChange('showColliderBounds')}
            ></sl-switch>
            <label for="show-collider-bounds">${settingsSchema.showColliderBounds.label}</label>
          </div>

          <div>
            <sl-color-picker
              id="collider-bounds-colors"
              .hoist=${true}
              .value=${colorToHex(settingsStore.get('colliderBoundsColor'))}
              opacity
              @sl-input=${this._handleColorInput('colliderBoundsColor')}
              >Color</sl-color-picker
            >
          </div>
        </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-geometry-bounds"
              .checked=${settingsStore.get('showGeometryBounds')}
              @sl-change=${this._handleSwitchChange('showGeometryBounds')}
            ></sl-switch>
            <label for="show-geometry-bounds">${settingsSchema.showGeometryBounds.label}</label>
          </div>

          <div>
            <sl-color-picker
              id="collider-geometry-colors"
              .hoist=${true}
              .value=${colorToHex(settingsStore.get('geometryBoundsColor'))}
              opacity
              @sl-input=${this._handleColorInput('geometryBoundsColor')}
              >Color</sl-color-picker>
          </div>
        </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-collision-type"
              .checked=${settingsStore.get('showCollisionType')}
              @sl-change=${this._handleSwitchChange('showCollisionType')}
            ></sl-switch>
            <label for="show-collision-type">${settingsSchema.showCollisionType.label}</label>
          </div>
          <div>
          </div>
        </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-collision-group"
              .checked=${settingsStore.get('showCollisionGroup')}
              @sl-change=${this._handleSwitchChange('showCollisionGroup')}
            ></sl-switch>
            <label for="show-collision-group">${settingsSchema.showCollisionGroup.label}</label>
          </div>
          <div>
          </div>
        </div>
      </form>
    </div>
    `;
  }

  entityHtml() {
    return html`
    <h2>Entity</h2>
    <div class="section">
      <form>
        <div>
          <sl-switch
            id="show-names"
            .checked=${settingsStore.get('showNames')}
            @sl-change=${this._handleSwitchChange('showNames')}
          ></sl-switch>
          <label for="show-names">${settingsSchema.showNames.label}</label>
        </div>
        <div>
          <sl-switch
            id="show-ids"
            .checked=${settingsStore.get('showIds')}
            @sl-change=${this._handleSwitchChange('showIds')}
          ></sl-switch>
          <label for="show-ids">${settingsSchema.showIds.label}</label>
        </div>
      </form>
    </div>
    `;
  }

  debugTextHtml() {
    return html`
    <h2>Debug Text Color</h2>
    <div class="section">
      <form>
        <div class="form-row">
          <sl-label for="debug-text-foreground-color">Foreground</sl-label>
          <sl-color-picker
            id="debug-text-foreground-color"
            .hoist=${true}
            .value=${colorToHex(settingsStore.get('debugTextForegroundColor'))}
            opacity
            @sl-input=${this._handleColorInput('debugTextForegroundColor')}>Foreground Color
          </sl-color-picker>
       </div>

        <div class="form-row">
          <sl-label for="debug-text-background-color">Background</sl-label>
          <sl-color-picker
            id="debug-text-background-color"
            .hoist=${true}
            .value=${colorToHex(settingsStore.get('debugTextBackgroundColor'))}
            opacity
            @sl-input=${this._handleColorInput('debugTextBackgroundColor')}>Background Color
          </sl-color-picker>
        </div>

        <div class="form-row">
          <sl-label for="debug-text-border-color">Border</sl-label>
          <sl-color-picker
            id="debug-text-border-color"
            .hoist=${true}
            .value=${colorToHex(settingsStore.get('debugTextBorderColor'))}
            opacity
            @sl-input=${this._handleColorInput('debugTextBorderColor')}>Background Color
          </sl-color-picker>
        </div>
      </form>
    </div>
    `;
  }

  physicsHtml() {
    return html`
    <h2>Physics</h2>
    <div class="section">
      <form>
        <div class="form-row">

          <div>
            <sl-switch
              id="show-contact-normal"
              .checked=${settingsStore.get('showContactNormal')}
              @sl-change=${this._handleSwitchChange('showContactNormal')}
            ></sl-switch>
            <label for="show-contact-normal">${settingsSchema.showContactNormal.label}</label>
          </div>
          <sl-color-picker
            id="debug-contact-normal-color"
            .hoist=${true}
            .value=${colorToHex(settingsStore.get('contactNormalColor'))}
            opacity
            @sl-input=${this._handleColorInput('contactNormalColor')}>Contact Normal Color
          </sl-color-picker>
       </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-contact"
              .checked=${settingsStore.get('showContact')}
              @sl-change=${this._handleSwitchChange('showContact')}
            ></sl-switch>
            <label for="show-contact">Show Contact</label>
          </div>
          <sl-color-picker
            id="debug-contact-color"
            .hoist=${true}
            .value=${colorToHex(settingsStore.get('contactColor'))}
            opacity
            @sl-input=${this._handleColorInput('contactColor')}>Contact Color
          </sl-color-picker>
        </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-space-partitioning"
              .checked=${settingsStore.get('showSpacePartition')}
              @sl-change=${this._handleSwitchChange('showSpacePartition')}
            ></sl-switch>
            <label for="show-space-partitioning">${settingsSchema.showSpacePartition.label}</label>
          </div>
          <div>
          </div>
        </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-body-mass"
              .checked=${settingsStore.get('showMass')}
              @sl-change=${this._handleSwitchChange('showMass')}
            ></sl-switch>
            <label for="show-body-mass">Show Body Mass</label>
          </div>
          <div>
          </div>
        </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-body-motion"
              .checked=${settingsStore.get('showMotion')}
              @sl-change=${this._handleSwitchChange('showMotion')}
            ></sl-switch>
            <label for="show-body-motion">Show Body Motion</label>
          </div>
          <div>
          </div>
        </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-body-sleeping"
              .checked=${settingsStore.get('showSleeping')}
              @sl-change=${this._handleSwitchChange('showSleeping')}
            ></sl-switch>
            <label for="show-body-sleeping">Show Body Sleeping</label>
          </div>
          <div>
          </div>
        </div>
      </form>
    </div>
    `;
  }

  tilemapHtml() {
    return html`
    <h2>Tilemap</h2>
    <div class="section">
      <form>
        <div class="form-row">
          <div>
            <sl-switch
              id="show-grid-tilemap"
              .checked=${settingsStore.get('showTileMapGrid')}
              @sl-change=${this._handleSwitchChange('showTileMapGrid')}
            ></sl-switch>
            <label for="show-grid-tilemap">${settingsSchema.showTileMapGrid.label}</label>
          </div>
          <sl-color-picker
            id="debug-grid-tilemap-color"
            .hoist=${true}
            .value=${colorToHex(settingsStore.get('tileMapGridColor'))}
            opacity
            @sl-input=${this._handleColorInput('tileMapGridColor')}>Grid Tilemap Color
          </sl-color-picker>
       </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-grid-isometric"
              .checked=${settingsStore.get('showIsometricGrid')}
              @sl-change=${this._handleSwitchChange('showIsometricGrid')}
            ></sl-switch>
            <label for="show-grid-isometric">${settingsSchema.showIsometricGrid.label}</label>
          </div>
          <sl-color-picker
            id="debug-grid-isometric-color"
            .hoist=${true}
            .value=${colorToHex(settingsStore.get('isometricGridColor'))}
            opacity
            @sl-input=${this._handleColorInput('isometricGridColor')}>Grid Isometric Color
          </sl-color-picker>
        </div>
      </form>
    </div>
    `;
  }

  render() {
    return html`
<div class="row">
  <div class="widget">
    <h2>Debug Draw Settings</h2>
    <div class="section">
      <form>
        <div>
          <sl-button id="toggle-debug" @click="${this._dispatchToggleDebugDraw}">Toggle Debug Draw</sl-button>
        </div>
      </form>
    </div>
  </div>
</div>

<div class="row">
  <div class="widget">
    ${ this.transformHtml() }
    ${ this.componentsHtml() }
  </div>

  <div class="widget">
    ${ this.entityHtml() }
    ${ this.debugTextHtml() }
  </div>
</div>

<div class="row">
  <div class="widget">
    ${ this.physicsHtml() }
  </div>

  <div class="widget">
    ${ this.tilemapHtml() }
  </div>
</div>
    `;
  }
}
