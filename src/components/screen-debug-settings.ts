import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { colors } from '../colors';
import { common } from '../common';
import { SlChangeEvent, SlColorPicker, SlInputEvent, SlSwitch } from '@shoelace-style/shoelace';
import {
  settingsStore,
  settingsSchema,
  hexToColor,
  colorToHex,
  BooleanSettingsKey,
  ColorSettingsKey,
} from '../settings';

/**
 * Controls for the `debug.screen.*` overlay (Excalibur v0.33+):
 * visualizes `Screen.contentArea` (safe area) and `Screen.unsafeArea`
 * (possibly clipping region under `*AndFill`/`*AndZoom` display modes)
 * plus a legend.
 *
 * The engine gates all overlay rendering behind `debug.screen.showAll`,
 * so the master toggle must be on for any sub-toggle/color to take effect.
 * Sub-toggles and colors are persisted via `settingsStore` and dispatched
 * to the background through the shared `debug-settings-change` event, so
 * no app-main handler is required for this component.
 * @event debug-settings-change - Emitted when any screen-debug setting changes
 */
@customElement('screen-debug-settings')
export class ScreenDebugSettings extends LitElement {
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

      .indent {
        margin-left: 22px;
      }

      .unsupported {
        padding: 6px 0;
      }
    `
  ];

  override shouldUpdate() {
    return this.isConnected;
  }

  /**
   * When false, the running Excalibur engine is older than v0.33.0 and the
   * `debug.screen.*` paths do not exist; the overlay is replaced with a
   * version-warning notice. `patchByPath` in the background silently skips
   * missing paths, so toggling on an old engine is a safe no-op.
   */
  @property({ type: Boolean })
  unsupported = false;

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

  private _dispatchChange() {
    this.dispatchEvent(
      new CustomEvent('debug-settings-change', {
        detail: settingsStore.getAll(),
        bubbles: true,
        composed: true
      })
    );
  }

  private _handleSwitchChange(key: BooleanSettingsKey) {
    return (evt: SlChangeEvent) => {
      settingsStore.setBoolean(key, (evt.target as SlSwitch).checked);
      this._dispatchChange();
    };
  }

  private _handleColorInput(key: ColorSettingsKey) {
    return (evt: SlInputEvent) => {
      settingsStore.setColor(key, hexToColor((evt.target as SlColorPicker).value));
      this._dispatchChange();
    };
  }

  render() {
    if (this.unsupported) {
      return html`
        <h2>Screen Debug</h2>
        <div class="section unsupported">
          This overlay requires Excalibur v0.33.0 or an alpha build.
          <div class="hint">Upgrade the engine to visualize the contentArea / unsafeArea bounds.</div>
        </div>
      `;
    }

    const showAll = settingsStore.get('screenDebugShowAll');

    return html`
      <h2>Screen Debug</h2>
      <div class="section">
        <form>
          <div class="form-row">
            <div>
              <sl-switch
                id="screen-debug-show-all"
                .checked=${showAll}
                @sl-change=${this._handleSwitchChange('screenDebugShowAll')}
              ></sl-switch>
              <label for="screen-debug-show-all">${settingsSchema.screenDebugShowAll.label}</label>
            </div>
            <div></div>
          </div>

          ${showAll ? html`
            <div class="form-row indent">
              <div>
                <sl-switch
                  id="screen-debug-show-content-area"
                  .checked=${settingsStore.get('screenDebugShowContentArea')}
                  @sl-change=${this._handleSwitchChange('screenDebugShowContentArea')}
                ></sl-switch>
                <label for="screen-debug-show-content-area">${settingsSchema.screenDebugShowContentArea.label}</label>
              </div>
              <div>
                <sl-color-picker
                  id="screen-debug-content-area-color"
                  format="hex"
                  .noFormatToggle=${true}
                  .hoist=${true}
                  .value=${colorToHex(settingsStore.get('screenContentAreaColor'))}
                  opacity
                  @sl-input=${this._handleColorInput('screenContentAreaColor')}>Color</sl-color-picker>
              </div>
            </div>

            <div class="form-row indent">
              <div>
                <sl-switch
                  id="screen-debug-show-unsafe-area"
                  .checked=${settingsStore.get('screenDebugShowUnsafeArea')}
                  @sl-change=${this._handleSwitchChange('screenDebugShowUnsafeArea')}
                ></sl-switch>
                <label for="screen-debug-show-unsafe-area">${settingsSchema.screenDebugShowUnsafeArea.label}</label>
              </div>
              <div>
                <sl-color-picker
                  id="screen-debug-unsafe-area-color"
                  format="hex"
                  .noFormatToggle=${true}
                  .hoist=${true}
                  .value=${colorToHex(settingsStore.get('screenUnsafeAreaColor'))}
                  opacity
                  @sl-input=${this._handleColorInput('screenUnsafeAreaColor')}>Color</sl-color-picker>
              </div>
            </div>

            <div class="form-row indent">
              <div>
                <sl-switch
                  id="screen-debug-show-legend"
                  .checked=${settingsStore.get('screenDebugShowLegend')}
                  @sl-change=${this._handleSwitchChange('screenDebugShowLegend')}
                ></sl-switch>
                <label for="screen-debug-show-legend">${settingsSchema.screenDebugShowLegend.label}</label>
              </div>
              <div>
                <sl-color-picker
                  id="screen-debug-legend-color"
                  format="hex"
                  .noFormatToggle=${true}
                  .hoist=${true}
                  .value=${colorToHex(settingsStore.get('screenLegendColor'))}
                  opacity
                  @sl-input=${this._handleColorInput('screenLegendColor')}>Color</sl-color-picker>
              </div>
            </div>
          ` : ''}
        </form>
      </div>
    `;
  }
}