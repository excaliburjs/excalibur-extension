import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { colors } from '../colors';
import { common } from '../common';
import { formatMatrix, formatValue } from '../format';
import type { SlColorPicker, SlInput, SlSwitch } from '@shoelace-style/shoelace';
import type { MaterialUniform } from './material-detail';

/**
 * One uniform edit coming out of a `<uniform-table>`; the parent wraps it
 * with its own addressing (material vs pipeline pass) before shipping it to
 * the page.
 */
export interface UniformEdit {
  uniformName: string;
  kind: 'float' | 'int' | 'bool' | 'floatArray';
  value: number | boolean | number[];
}

/**
 * Name/type/value table for a list of uniforms with optional inline editors
 * (switch, number input, vec2-4 inputs with a color picker on vec4).
 *
 * Every editor input carries class `uniform-editor`, which the enclosing
 * detail views use (via composedPath, so it crosses this shadow root) to
 * freeze their 5Hz re-renders while the user is typing.
 * @event uniform-edit - Emitted with a UniformEdit when the user commits a value
 */
@customElement('uniform-table')
export class UniformTable extends LitElement {
  static styles = [
    colors,
    common,
    css`
      :host {
        display: block;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }

      th {
        text-align: left;
        color: #888;
        font-weight: normal;
        padding: 4px 8px;
        border-bottom: 1px solid #333;
      }

      td {
        padding: 4px 8px;
        border-bottom: 1px solid #2a2a2a;
        vertical-align: middle;
      }

      .uniform-name {
        font-family: monospace;
        color: var(--blue-text);
      }

      .uniform-type {
        font-family: monospace;
        color: #888;
      }

      .uniform-value {
        font-family: monospace;
      }

      .matrix {
        font-family: monospace;
        font-size: 12px;
        margin: 0;
      }

      .vec-editor {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .vec-editor sl-input {
        width: 90px;
      }

      sl-input[type='number'] {
        width: 120px;
      }
    `
  ];

  override shouldUpdate() {
    return this.isConnected;
  }

  @property({ type: Array })
  uniforms: MaterialUniform[] = [];

  @property({ type: Boolean })
  editable = false;

  private _dispatchEdit(uniformName: string, kind: UniformEdit['kind'], value: UniformEdit['value']) {
    this.dispatchEvent(
      new CustomEvent<UniformEdit>('uniform-edit', {
        detail: { uniformName, kind, value },
        bubbles: true,
        composed: true
      })
    );
  }

  private _scalarChangeHandler(uniform: MaterialUniform) {
    return (evt: Event) => {
      const raw = (evt.target as SlInput).value;
      const num = Number(raw);
      // An emptied field ('' coerces to 0) or garbage must not overwrite the
      // uniform; the next heartbeat re-render restores the live value
      if (raw.trim() === '' || !Number.isFinite(num)) {
        return;
      }
      const kind = uniform.typeName === 'float' ? 'float' : 'int';
      this._dispatchEdit(uniform.name, kind, num);
    };
  }

  private _boolChangeHandler(uniform: MaterialUniform) {
    return (evt: Event) => {
      this._dispatchEdit(uniform.name, 'bool', (evt.target as SlSwitch).checked);
    };
  }

  private _vecChangeHandler(uniform: MaterialUniform) {
    return () => {
      const inputs = Array.from(this.shadowRoot!.querySelectorAll<SlInput>(`sl-input[data-uniform="${CSS.escape(uniform.name)}"]`)).sort(
        (a, b) => Number(a.dataset.index) - Number(b.dataset.index)
      );
      const values = inputs.map((input) => (input.value.trim() === '' ? NaN : Number(input.value)));
      // An emptied or non-numeric component must not be coerced to 0
      if (values.some((v) => !Number.isFinite(v))) {
        return;
      }
      this._dispatchEdit(uniform.name, 'floatArray', values);
    };
  }

  private _vec4ColorChangeHandler(uniform: MaterialUniform) {
    return (evt: Event) => {
      const rgba = (evt.target as SlColorPicker).getFormattedValue('rgba');
      const match = rgba.match(/rgba?\((\d+),?\s*(\d+),?\s*(\d+)(?:,?\s*\/?\s*([\d.%]+))?\)/);
      if (match) {
        let alpha = match[4] !== undefined ? parseFloat(match[4]) : 1;
        if (match[4]?.includes('%')) {
          alpha = alpha / 100;
        }
        this._dispatchEdit(uniform.name, 'floatArray', [+match[1] / 255, +match[2] / 255, +match[3] / 255, alpha]);
      }
    };
  }

  private _renderEditor(uniform: MaterialUniform) {
    const value = uniform.value;
    switch (uniform.typeName) {
      case 'bool':
        return html`
          <sl-switch class="uniform-editor" .checked=${value === true} @sl-change=${this._boolChangeHandler(uniform)}></sl-switch>
        `;
      case 'float':
      case 'int':
      case 'uint':
        return html`
          <sl-input
            class="uniform-editor"
            type="number"
            size="small"
            step=${uniform.typeName === 'float' ? 'any' : '1'}
            .value=${typeof value === 'number' ? value.toString() : '0'}
            @sl-change=${this._scalarChangeHandler(uniform)}
          ></sl-input>
        `;
      case 'vec2':
      case 'vec3':
      case 'vec4': {
        const dim = Number(uniform.typeName.slice(-1));
        const components = Array.isArray(value) ? value : new Array(dim).fill(0);
        return html`
          <div class="vec-editor">
            ${components
              .slice(0, dim)
              .map(
                (component, i) => html`
                  <sl-input
                    class="uniform-editor"
                    type="number"
                    size="small"
                    step="any"
                    data-uniform=${uniform.name}
                    data-index=${i}
                    .value=${component.toString()}
                    @sl-change=${this._vecChangeHandler(uniform)}
                  ></sl-input>
                `
              )}
            ${uniform.typeName === 'vec4'
              ? html`
                  <sl-color-picker
                    class="uniform-editor"
                    size="small"
                    opacity
                    .value=${Array.isArray(value)
                      ? `rgba(${Math.round((value[0] ?? 0) * 255)}, ${Math.round((value[1] ?? 0) * 255)}, ${Math.round(
                          (value[2] ?? 0) * 255
                        )}, ${value[3] ?? 1})`
                      : 'rgba(0, 0, 0, 1)'}
                    @sl-change=${this._vec4ColorChangeHandler(uniform)}
                  ></sl-color-picker>
                `
              : nothing}
          </div>
        `;
      }
      default:
        return html`<span class="uniform-value">${formatValue(value)}</span>`;
    }
  }

  private _renderValue(uniform: MaterialUniform) {
    if (Array.isArray(uniform.value) && uniform.typeName.startsWith('mat')) {
      const dim = Number(uniform.typeName.slice(-1));
      const value = uniform.value;
      // the flat array is column-major, so the first row strides by dim
      const firstRow = Array.from({ length: dim }, (_, c) => value[c * dim] ?? 0);
      return html`
        <sl-details summary=${formatValue(firstRow) + ' …'}>
          <pre class="matrix">${formatMatrix(uniform.value, dim)}</pre>
        </sl-details>
      `;
    }
    return html`<span class="uniform-value">${formatValue(uniform.value)}</span>`;
  }

  override render() {
    if (this.uniforms.length === 0) {
      return html`<div>None</div>`;
    }
    return html`
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          ${repeat(
            this.uniforms,
            (uniform) => uniform.name,
            (uniform) => html`
              <tr>
                <td class="uniform-name">${uniform.name}</td>
                <td class="uniform-type">${uniform.typeName}</td>
                <td>${this.editable && uniform.editable ? this._renderEditor(uniform) : this._renderValue(uniform)}</td>
              </tr>
            `
          )}
        </tbody>
      </table>
    `;
  }
}
