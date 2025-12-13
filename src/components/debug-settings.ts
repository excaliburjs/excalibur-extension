import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { colors } from '../colors';
import { common } from '../common';
import { SlChangeEvent, SlColorPicker, SlInputEvent, SlSwitch } from '@shoelace-style/shoelace';

interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

const black: Color = {
  r: 0,
  g: 0,
  b: 0,
  a: 1.0
};


const transparent: Color = {
  r: 0,
  g: 0,
  b: 0,
  a: 0.0
};

const hexToColor = (hex: string) => {
  hex = hex.substring(1);
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  let a = 1.0;
  if (hex.length > 6) {
    a = parseInt(hex.substring(6, 8), 16) / 255;
  }
  return { r, g, b, a } satisfies Color;
};

const colorToHex = (color: Color) => {
  const r = color.r.toString(16).padStart(2, '0');
  const g = color.g.toString(16).padStart(2, '0');
  const b = color.b.toString(16).padStart(2, '0');
  const a = Math.floor(color.a * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}${a}`;
};

export interface Settings {
  debugTextForegroundColor: Color;
  debugTextBackgroundColor: Color;
  debugTextBorderColor: Color;

  showNames: boolean;
  showIds: boolean;

  showPos: boolean;
  showPosLabel: boolean;
  posColor: Color;
  showRotation: boolean;
  rotationColor: Color;
  showScale: boolean;
  scaleColor: Color;
  showZIndex: boolean;

  showGraphicsBounds: boolean;
  graphicsBoundsColor: Color;

  showColliderBounds: boolean;
  colliderBoundsColor: Color;

  showGeometryBounds: boolean;
  geometryBoundsColor: Color;


  showContact: boolean;
  contactColor: Color;
  showContactNormal: boolean;
  contactNormalColor: Color;

  showSpacePartition: boolean;


  showTileMapGrid: boolean;
  tileMapGridColor: Color;
  showIsometricGrid: boolean;
  isometricGridColor: Color;
}

export const DefaultSettings: Settings = {
  debugTextForegroundColor: { r: 0, g: 0, b: 0, a: 1 },
  debugTextBackgroundColor: { r: 0, g: 0, b: 0, a: 0 },
  debugTextBorderColor: { r: 0, g: 0, b: 0, a: 0 },

  showNames: false,
  showIds: false,

  showPos: false,
  showPosLabel: false,
  posColor: { r: 0, g: 0, b: 0, a: 1 },

  showRotation: false,
  rotationColor: { r: 0, g: 0, b: 0, a: 1 },

  showScale: false,
  scaleColor: { r: 0, g: 0, b: 0, a: 1 },
  showZIndex: false,

  showGraphicsBounds: false,
  graphicsBoundsColor: { r: 0, g: 0, b: 0, a: 1 },

  showColliderBounds: false,
  colliderBoundsColor: { r: 0, g: 0, b: 0, a: 1 },

  showGeometryBounds: false,
  geometryBoundsColor: { r: 0, g: 0, b: 0, a: 1 },

  showContact: false,
  contactColor: { r: 255, g: 0, b: 0, a: 1 },
  showContactNormal: false,
  contactNormalColor: { r: 255, g: 0, b: 0, a: 1 },

  showSpacePartition: false,


  showTileMapGrid: false,
  tileMapGridColor: { r: 0, g: 0, b: 0, a: 1 },
  showIsometricGrid: false,
  isometricGridColor: { r: 0, g: 0, b: 0, a: 1 },

};

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

  @property({ type: Object })
  settings: Settings | null = {
    debugTextForegroundColor: { r: 0, g: 0, b: 0, a: 1 },
    debugTextBackgroundColor: { r: 0, g: 0, b: 0, a: 0 },
    debugTextBorderColor: { r: 0, g: 0, b: 0, a: 0 },

    showNames: false,
    showIds: false,
    showPos: false,
    showPosLabel: false,
    posColor: { r: 0, g: 0, b: 0, a: 1 },
    showRotation: false,
    rotationColor: { r: 0, g: 0, b: 0, a: 1 },
    showScale: false,
    scaleColor: { r: 0, g: 0, b: 0, a: 1 },
    showZIndex: false,

    showGraphicsBounds: false,
    graphicsBoundsColor: { r: 0, g: 0, b: 0, a: 1 },
    showColliderBounds: false,
    colliderBoundsColor: { r: 0, g: 0, b: 0, a: 1 },
    showGeometryBounds: false,
    geometryBoundsColor: { r: 0, g: 0, b: 0, a: 1 },

    showContact: false,
    contactColor: { r: 0, g: 0, b: 0, a: 1 },
    showContactNormal: false,
    contactNormalColor: { r: 0, g: 0, b: 0, a: 1 },

    showSpacePartition: false,

    showTileMapGrid: false,
    tileMapGridColor: { r: 0, g: 0, b: 0, a: 1 },
    showIsometricGrid: false,
    isometricGridColor: { r: 0, g: 0, b: 0, a: 1 },


  };

  updateSettings(settings: Settings) {
    this.settings = settings;
    this.requestUpdate();
  }

  dispatchDebugSettingsChange() {
    this.dispatchEvent(
      new CustomEvent<Settings | null>('debug-settings-change', {
        detail: this.settings,
        bubbles: true,
        composed: true
      })
    );
  }

  dispatchToggleDebugDraw() {
    this.dispatchEvent(
      new CustomEvent('toggle-debug-draw', {
        bubbles: true,
        composed: true
      })
    );
  }

  settingSwitchChangeHandler(setting: keyof Settings) {
    return (evt: SlChangeEvent) => {
      if (this.settings && typeof this.settings[setting] === 'boolean') {
        (this.settings[setting] as boolean) = !!(evt.target as SlSwitch).checked;
        this.dispatchDebugSettingsChange();
      }
    };
  }

  settingsColorInputHandler(setting: keyof Settings) {
    return (evt: SlInputEvent) => {
      if (this.settings && typeof this.settings[setting] === 'object') {
        (this.settings[setting] as Color) = hexToColor((evt.target as SlColorPicker).value);
        this.dispatchDebugSettingsChange();
      }
    };
  }

  render() {
    return html`
<div class="row">
  <div class="widget">
    <h2>Debug Draw Settings</h2>
    <div class="section">
      <form>
        <div>
          <sl-button id="toggle-debug" @click="${this.dispatchToggleDebugDraw}">Toggle Debug Draw</sl-button>
        </div>
      </form>
    </div>
  </div>
</div>

<div class="row">
  <div class="widget">
    <h2>Transform</h2>
    <div class="section">
      <form>
        <div class="form-row">
          <div>
            <sl-switch
              id="show-pos"
              .checked=${this.settings?.showPos ?? false}
              @sl-change=${this.settingSwitchChangeHandler('showPos')}
            ></sl-switch>
            <label for="show-pos">Show Position</label>
          </div>
          <div>
            <sl-switch
              id="show-pos-label"
              .checked=${this.settings?.showPosLabel ?? false}
              @sl-change=${this.settingSwitchChangeHandler('showPosLabel')}
            ></sl-switch>
            <label for="show-pos-label">Show Coordinates</label>
          </div>
          <div>
            <sl-color-picker
              id="show-pos-color"
              format="hex"
              .noFormatToggle=${true}
              .hoist=${true}
              .value=${colorToHex(this.settings?.posColor ?? black)}
              opacity
              @sl-input=${this.settingsColorInputHandler('posColor')}>Color</sl-color-picker>
          </div>
        </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-rotation"
              .checked=${this.settings?.showRotation ?? false}
              @sl-change=${this.settingSwitchChangeHandler('showRotation')}
            ></sl-switch>
            <label for="show-rotation">Show Rotation</label>
          </div>

          <div>
            <sl-color-picker
              id="show-rotation-color"
              format="hex"
              .noFormatToggle=${true}
              .hoist=${true}
              .value=${colorToHex(this.settings?.rotationColor ?? black)}
              opacity
              @sl-input=${this.settingsColorInputHandler('rotationColor')}>Color</sl-color-picker>
          </div>
        </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-scale"
              .checked=${this.settings?.showScale ?? false}
              @sl-change=${this.settingSwitchChangeHandler('showScale')}
            ></sl-switch>
            <label for="show-scale">Show Scale</label>
          </div>
          <div>
            <sl-color-picker
              id="show-scale-color"
              format="hex"
              .noFormatToggle=${true}
              .hoist=${true}
              .value=${colorToHex(this.settings?.scaleColor ?? black)}
              opacity
              @sl-input=${this.settingsColorInputHandler('scaleColor')}>Color</sl-color-picker>
          </div>
        </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-zindex"
              .checked=${this.settings?.showZIndex ?? false}
              @sl-change=${this.settingSwitchChangeHandler('showZIndex')}
            ></sl-switch>
            <label for="show-rotation">Show Z Index</label>
          </div>
          <div>
          </div>
        </div>
      </form>
    </div>

    <h2>Components</h2>
    <div class="section">
      <form>
          <div class="form-row">
            <div>
              <sl-switch
                id="show-graphics-bounds"
                .checked=${this.settings?.showGraphicsBounds ?? false}
                @sl-change=${this.settingSwitchChangeHandler('showGraphicsBounds')}
              ></sl-switch>
              <label for="show-graphics-bounds">Show Graphics Bounds</label>
            </div>

            <div>
              <sl-color-picker
                id="graphics-bounds-colors"
                .hoist=${true}
                .value=${colorToHex(this.settings?.graphicsBoundsColor ?? black)}
                opacity
                @sl-input=${this.settingsColorInputHandler('graphicsBoundsColor')}
                >Color</sl-color-picker
              >
            </div>
          </div>

          <div class="form-row">
            <div>
              <sl-switch
                id="show-collider-bounds"
                .checked=${this.settings?.showColliderBounds ?? false}
                @sl-change=${this.settingSwitchChangeHandler('showColliderBounds')}
              ></sl-switch>
              <label for="show-collider-bounds">Show Collider Bounds</label>
            </div>

            <div>
              <sl-color-picker
                id="collider-bounds-colors"
                .hoist=${true}
                .value=${colorToHex(this.settings?.colliderBoundsColor ?? black)}
                opacity
                @sl-input=${this.settingsColorInputHandler('colliderBoundsColor')}
                >Color</sl-color-picker
              >
            </div>
          </div>

          <div class="form-row">
            <div>
              <sl-switch
                id="show-geometry-bounds"
                .checked=${this.settings?.showGeometryBounds ?? false}
                @sl-change=${this.settingSwitchChangeHandler('showGeometryBounds')}
              ></sl-switch>
              <label for="show-geometry-bounds">Show Geometry</label>
            </div>

            <div>
              <sl-color-picker
                id="collider-geometry-colors"
                .hoist=${true}
                .value=${colorToHex(this.settings?.geometryBoundsColor ?? black)}
                opacity
                @sl-input=${this.settingsColorInputHandler('geometryBoundsColor')}
                >Color</sl-color-picker>
            </div>
          </div>
        </form>
      </div>
    </div>

  <div class="widget">
    <h2>Entity</h2>
    <div class="section">
      <form>
        <div>
          <sl-switch
            id="show-names"
            .checked=${this.settings?.showNames ?? false}
            @sl-change=${this.settingSwitchChangeHandler('showNames')}
          ></sl-switch>
          <label for="show-names">Show Names</label>
        </div>
        <div>
          <sl-switch
            id="show-ids"
            .checked=${this.settings?.showIds ?? false}
            @sl-change=${this.settingSwitchChangeHandler('showIds')}
          ></sl-switch>
          <label for="show-ids">Show Ids</label>
        </div>
      </form>
    </div>

    <h2>Debug Text Color</h2>
    <div class="section">
      <form>
        <div class="form-row">
          <sl-label for="debug-text-foreground-color">Foreground</sl-label>
          <sl-color-picker
            id="debug-text-foreground-color"
            .hoist=${true}
            .value=${colorToHex(this.settings?.debugTextForegroundColor ?? black)}
            opacity
            @sl-input=${this.settingsColorInputHandler('debugTextForegroundColor')}>Foreground Color
          </sl-color-picker>
       </div>

        <div class="form-row">
          <sl-label for="debug-text-background-color">Background</sl-label>
          <sl-color-picker
            id="debug-text-background-color"
            .hoist=${true}
            .value=${colorToHex(this.settings?.debugTextBackgroundColor ?? transparent)}
            opacity
            @sl-input=${this.settingsColorInputHandler('debugTextBackgroundColor')}>Background Color
          </sl-color-picker>
        </div>

        <div class="form-row">
          <sl-label for="debug-text-border-color">Border</sl-label>
          <sl-color-picker
            id="debug-text-border-color"
            .hoist=${true}
            .value=${colorToHex(this.settings?.debugTextBorderColor ?? transparent)}
            opacity
            @sl-input=${this.settingsColorInputHandler('debugTextBorderColor')}>Background Color
          </sl-color-picker>
        </div>
      </form>
    </div>
  </div>
</div>


<div class="row">
  
  <div class="widget">
    <h2>Physics</h2>

    <div class="section">
      <form>
        <div class="form-row">

          <div>
            <sl-switch
              id="show-contact-normal"
              .checked=${this.settings?.showContactNormal ?? false}
              @sl-change=${this.settingSwitchChangeHandler('showContactNormal')}
            ></sl-switch>
            <label for="show-contact-normal">Show Contact Normal</label>
          </div>
          <sl-color-picker
            id="debug-contact-normal-color"
            .hoist=${true}
            .value=${colorToHex(this.settings?.contactNormalColor?? black)}
            opacity
            @sl-input=${this.settingsColorInputHandler('contactNormalColor')}>Contact Normal Color
          </sl-color-picker>
       </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-contact"
              .checked=${this.settings?.showContact ?? false}
              @sl-change=${this.settingSwitchChangeHandler('showContact')}
            ></sl-switch>
            <label for="show-contact-normal">Show Contact</label>
          </div>
          <sl-color-picker
            id="debug-contact-color"
            .hoist=${true}
            .value=${colorToHex(this.settings?.contactColor?? black)}
            opacity
            @sl-input=${this.settingsColorInputHandler('contactColor')}>Contact Color
          </sl-color-picker>
        </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-space-partitioning"
              .checked=${this.settings?.showSpacePartition ?? false}
              @sl-change=${this.settingSwitchChangeHandler('showSpacePartition')}
            ></sl-switch>
            <label for="show-contact-normal">Show Space Partitioning</label>
          </div>
          <div>
          </div>
        </div>

      </form>
    </div>

  </div>


  <div class="widget">
    <h2>Tilemap</h2>

    <div class="section">
      <form>
        <div class="form-row">

          <div>
            <sl-switch
              id="show-grid-tilemap"
              .checked=${this.settings?.showTileMapGrid ?? false}
              @sl-change=${this.settingSwitchChangeHandler('showTileMapGrid')}
            ></sl-switch>
            <label for="show-grid-tilemap">Show Grid Tilemap</label>
          </div>
          <sl-color-picker
            id="debug-grid-tilemap-color"
            .hoist=${true}
            .value=${colorToHex(this.settings?.tileMapGridColor ?? black)}
            opacity
            @sl-input=${this.settingsColorInputHandler('tileMapGridColor')}>Grid Tilemap Color
          </sl-color-picker>
       </div>

        <div class="form-row">
          <div>
            <sl-switch
              id="show-grid-isometric"
              .checked=${this.settings?.showIsometricGrid ?? false}
              @sl-change=${this.settingSwitchChangeHandler('showIsometricGrid')}
            ></sl-switch>
            <label for="show-grid-isometric">Show Grid Isometric</label>
          </div>
          <sl-color-picker
            id="debug-grid-isometric-color"
            .hoist=${true}
            .value=${colorToHex(this.settings?.isometricGridColor ?? black)}
            opacity
            @sl-input=${this.settingsColorInputHandler('isometricGridColor')}>Grid Isometric Color
          </sl-color-picker>
        </div>
      </form>
    </div>

  </div>

</div>
    `;
  }
}
