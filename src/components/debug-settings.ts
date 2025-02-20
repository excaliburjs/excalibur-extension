import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { colors } from '../colors';
import { common } from '../common';
import { SlChangeEvent, SlColorPicker, SlInputEvent, SlSwitch } from '@shoelace-style/shoelace';

export interface DebugStats {
  currFrame: {
    _fps: number;
    _elapsedMs: number;
    _delta?: number;
    _durationStats: {
      total: number;
      update: number;
      draw: number;
    };
    _graphicsStats: {
      drawCalls: number;
    };
    _actorStats: {
      total: number;
    };
  };
}

export interface Debug {
  /**
   * Performance statistics
   */
  stats: DebugStats;
  /**
   * Filter debug context to named entities or entity ids
   */
  filter: {
    useFilter: boolean;
    nameQuery: string;
    ids: number[];
  };
  /**
   * Entity debug settings
   */
  entity: {
    showAll: boolean;
    showId: boolean;
    showName: boolean;
  };
  /**
   * Transform component debug settings
   */
  transform: {
    showAll: boolean;
    showPosition: boolean;
    showPositionLabel: boolean;
    positionColor: Color;
    showZIndex: boolean;
    showScale: boolean;
    scaleColor: Color;
    showRotation: boolean;
    rotationColor: Color;
  };
  /**
   * Graphics component debug settings
   */
  graphics: {
    showAll: boolean;
    showBounds: boolean;
    boundsColor: Color;
  };
  /**
   * Collider component debug settings
   */
  collider: {
    showAll: boolean;
    showBounds: boolean;
    boundsColor: Color;
    showOwner: boolean;
    showGeometry: boolean;
    geometryColor: Color;
  };
  /**
   * Physics simulation debug settings
   */
  physics: {
    showAll: boolean;
    showBroadphaseSpacePartitionDebug: boolean;
    showCollisionNormals: boolean;
    collisionNormalColor: Color;
    showCollisionContacts: boolean;
    collisionContactColor: Color;
  };
  /**
   * Motion component debug settings
   */
  motion: {
    showAll: boolean;
    showVelocity: boolean;
    velocityColor: Color;
    showAcceleration: boolean;
    accelerationColor: Color;
  };
  /**
   * Body component debug settings
   */
  body: {
    showAll: boolean;
    showCollisionGroup: boolean;
    showCollisionType: boolean;
    showSleeping: boolean;
    showMotion: boolean;
    showMass: boolean;
  };
  /**
   * Camera debug settings
   */
  camera: {
    showAll: boolean;
    showFocus: boolean;
    focusColor: Color;
    showZoom: boolean;
  };
}

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

const hexToColor = (hex: string) => {
  hex = hex.substring(1);
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return { r, g, b, a: 1.0 } satisfies Color;
};

const colorToHex = (color: Color) => {
  const r = color.r.toString(16).padStart(2, '0');
  const g = color.g.toString(16).padStart(2, '0');
  const b = color.b.toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
};

export interface Settings {
  showNames: boolean;
  showIds: boolean;
  showPos: boolean;
  showPosLabel: boolean;
  posColor: Color;
  showGraphicsBounds: boolean;
  graphicsBoundsColor: Color;
  showColliderBounds: boolean;
  colliderBoundsColor: Color;
  showGeometryBounds: boolean;
  geometryBoundsColor: Color;
}

export const DefaultSettings: Settings = {
  showNames: false,
  showIds: false,
  showPos: false,
  showPosLabel: false,
  posColor: { r: 0, g: 0, b: 0, a: 1 },
  showGraphicsBounds: false,
  graphicsBoundsColor: { r: 0, g: 0, b: 0, a: 1 },
  showColliderBounds: false,
  colliderBoundsColor: { r: 0, g: 0, b: 0, a: 1 },
  showGeometryBounds: false,
  geometryBoundsColor: { r: 0, g: 0, b: 0, a: 1 }
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
    showNames: false,
    showIds: false,
    showPos: false,
    showPosLabel: false,
    posColor: { r: 0, g: 0, b: 0, a: 1 },
    showGraphicsBounds: false,
    graphicsBoundsColor: { r: 0, g: 0, b: 0, a: 1 },
    showColliderBounds: false,
    colliderBoundsColor: { r: 0, g: 0, b: 0, a: 1 },
    showGeometryBounds: false,
    geometryBoundsColor: { r: 0, g: 0, b: 0, a: 1 }
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
      <div class="debug-settings section">
        <form>
          <div>
            <sl-button id="toggle-debug" @click="${this.dispatchToggleDebugDraw}">Toggle Debug Draw</sl-button>
          </div>

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
              <label for="show-pos-label">Show Label</label>
            </div>
            <div>
              <sl-color-picker
                id="show-pos-color"
                .format=${'hex'}
                .noFormatToggle=${true}
                .hoist=${true}
                .value=${colorToHex(this.settings?.posColor ?? black)}
                @sl-input=${this.settingsColorInputHandler('posColor')}
                >Color</sl-color-picker
              >
            </div>
          </div>

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
                @sl-input=${this.settingsColorInputHandler('geometryBoundsColor')}
                >Color</sl-color-picker
              >
            </div>
          </div>
        </form>
      </div>
    `;
  }
}
