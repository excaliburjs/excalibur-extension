import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { guard } from 'lit/directives/guard.js';
import { colors } from '../colors';
import { common } from '../common';
import { highlightGlsl } from '../glsl-highlight';
import { SlColorPicker, SlInput, SlRange, SlSwitch } from '@shoelace-style/shoelace';

export interface MaterialUniform {
  name: string;
  typeName: string;
  builtIn: boolean;
  editable: boolean;
  value: number | boolean | number[] | null;
}

export interface MaterialImage {
  sampler: string;
  width: number;
  height: number;
  loaded: boolean;
  label: string;
  builtIn?: boolean;
  slot?: number;
  filtering?: string | null;
  wrapX?: string | null;
  wrapY?: string | null;
}

export interface MaterialSummary {
  id: number;
  name: string;
  key: string;
  color: { r: number; g: number; b: number; a: number } | null;
  isUsingScreenTexture: boolean;
  isOverridingGraphic: boolean;
  compiled: boolean;
  sourceHash: number;
  uniforms: MaterialUniform[];
  images: MaterialImage[];
}

export interface MaterialsState {
  source: 'registry' | 'scan';
  list: MaterialSummary[];
}

export interface MaterialTexture {
  sampler: string;
  dataUrl: string | null;
  width: number;
  height: number;
  label: string;
  filtering?: string | null;
  wrapX?: string | null;
  wrapY?: string | null;
}

export interface MaterialDetail {
  key: string;
  vertexSource: string;
  fragmentSource: string;
  processedByGlslTag: boolean;
  textures: MaterialTexture[];
}

export interface UniformChange {
  materialId: number;
  materialName: string;
  uniformName: string;
  kind: 'float' | 'int' | 'bool' | 'floatArray' | 'color';
  value: number | boolean | number[] | { r: number; g: number; b: number; a: number };
}

/**
 * Formats a number for display, trimming float noise to 4 decimal places.
 */
function formatNumber(n: number): string {
  if (Number.isInteger(n)) {
    return n.toString();
  }
  return (Math.round(n * 10000) / 10000).toString();
}

/**
 * Formats a uniform value (scalar, boolean, or array) for display.
 */
function formatValue(value: MaterialUniform['value']): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value.toString();
  }
  if (typeof value === 'number') {
    return formatNumber(value);
  }
  return `[${value.map(formatNumber).join(', ')}]`;
}

/**
 * Formats a flat column-major matrix array (the GL convention returned by
 * gl.getUniform) as aligned rows for conventional row-major reading.
 */
function formatMatrix(value: number[], dim: number): string {
  const rows: string[] = [];
  for (let r = 0; r < dim; r++) {
    const row: number[] = [];
    for (let c = 0; c < dim; c++) {
      row.push(value[r + c * dim]);
    }
    rows.push(row.map((n) => formatNumber(n).padStart(10)).join(' '));
  }
  return rows.join('\n');
}

/**
 * Formats a texture's sampling modes as "filtering · wrap" (e.g. "Pixel · Clamp"
 * or "Blended · Repeat×Mirror"), or null when unknown.
 */
function formatSampling(texture: Pick<MaterialTexture, 'filtering' | 'wrapX' | 'wrapY'>): string | null {
  const parts: string[] = [];
  if (texture.filtering) {
    parts.push(texture.filtering);
  }
  if (texture.wrapX || texture.wrapY) {
    const x = texture.wrapX ?? '?';
    const y = texture.wrapY ?? '?';
    parts.push(x === y ? x : `${x}×${y}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Detail view for a single material: info, editable custom uniforms,
 * live built-in uniforms, textures, and shader sources.
 * @event uniform-change - Emitted when the user edits a uniform value
 */
@customElement('material-detail')
export class MaterialDetailView extends LitElement {
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

      .swatch {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 1px solid #555;
        vertical-align: middle;
        margin-right: 5px;
      }

      .textures-toolbar {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      .textures-toolbar .label {
        color: #888;
        font-size: 12px;
      }

      .textures-toolbar sl-range {
        width: 160px;
      }

      .textures {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .texture {
        background-color: var(--darker-panel-color);
        padding: 10px;
        text-align: center;
        max-width: calc(var(--preview-size, 192px) + 20px);
      }

      .texture.clickable {
        cursor: zoom-in;
      }

      .texture.clickable:hover {
        outline: 1px solid #555;
      }

      .texture img {
        width: var(--preview-size, 192px);
        height: var(--preview-size, 192px);
        object-fit: contain;
        image-rendering: pixelated;
        background:
          repeating-conic-gradient(#333 0% 25%, #444 0% 50%) 0 0 / 16px 16px;
      }

      .texture .placeholder {
        width: var(--preview-size, 192px);
        height: var(--preview-size, 192px);
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #2a2a2a;
        color: #666;
      }

      sl-dialog.texture-inspect {
        --width: calc(100vw - 32px);
      }

      .inspect-toolbar {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      .inspect-meta {
        color: #888;
        font-size: 12px;
        word-break: break-all;
      }

      .inspect-viewport {
        height: calc(100vh - 220px);
        overflow: auto;
        display: flex;
        background:
          repeating-conic-gradient(#333 0% 25%, #444 0% 50%) 0 0 / 16px 16px;
      }

      .inspect-viewport img {
        display: block;
        margin: auto;
        image-rendering: pixelated;
      }

      .inspect-viewport img.fit {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .texture .meta {
        font-size: 12px;
        color: #888;
        margin-top: 5px;
        word-break: break-all;
      }

      .texture .sampler {
        font-family: monospace;
        color: var(--blue-text);
      }

      pre.source {
        background-color: var(--darker-panel-color);
        padding: 10px;
        overflow-x: auto;
        font-size: 12px;
        line-height: 1.4;
        margin: 0;
        user-select: text;
      }

      .tok-comment {
        color: #6a9955;
      }

      .tok-preproc {
        color: #c586c0;
      }

      .tok-keyword {
        color: #569cd6;
      }

      .tok-type {
        color: #4ec9b0;
      }

      .tok-builtin {
        color: #dcdcaa;
      }

      .tok-number {
        color: #b5cea8;
      }

      sl-details {
        margin-bottom: 10px;
      }

      sl-tag {
        margin-left: 5px;
      }

      .info-row {
        margin-bottom: 5px;
      }

      .info-row .label {
        color: #888;
        margin-right: 5px;
      }
    `
  ];

  @property({ type: Object })
  material: MaterialSummary | null = null;

  @property({ type: Object })
  detail: MaterialDetail | null = null;

  /**
   * While an editor input inside this component has focus, freeze re-renders so
   * the 5Hz heartbeat doesn't clobber in-progress typing.
   */
  @state()
  private _editorFocused = false;

  /**
   * Size in px of texture preview tiles in the grid, driven by the size slider.
   */
  @state()
  private _previewSize = 192;

  /**
   * Sampler name of the texture open in the inspect dialog, or null when closed.
   */
  @state()
  private _inspectedSampler: string | null = null;

  /**
   * Inspect dialog zoom: 0 = fit to viewport, otherwise a 1/2/4/8 multiplier
   * of the real texture dimensions.
   */
  @state()
  private _zoom = 0;

  protected override willUpdate(changed: PropertyValues<this>): void {
    // close the inspect dialog when switching to a different material
    if (changed.has('material')) {
      const previous = changed.get('material') as MaterialSummary | null | undefined;
      if (!this.material || (previous && previous.key !== this.material.key)) {
        this._inspectedSampler = null;
        this._zoom = 0;
      }
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('focusin', this._handleFocusIn);
    this.addEventListener('focusout', this._handleFocusOut);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('focusin', this._handleFocusIn);
    this.removeEventListener('focusout', this._handleFocusOut);
    super.disconnectedCallback();
  }

  private _isEditorTarget(evt: Event): boolean {
    return evt.composedPath().some((el) => el instanceof HTMLElement && el.classList?.contains('uniform-editor'));
  }

  private _handleFocusIn = (evt: Event) => {
    if (this._isEditorTarget(evt)) {
      this._editorFocused = true;
    }
  };

  private _handleFocusOut = (evt: Event) => {
    if (this._isEditorTarget(evt)) {
      this._editorFocused = false;
    }
  };

  override shouldUpdate() {
    return this.isConnected && !this._editorFocused;
  }

  private _dispatchUniformChange(uniformName: string, kind: UniformChange['kind'], value: UniformChange['value']) {
    if (!this.material) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<UniformChange>('uniform-change', {
        detail: {
          materialId: this.material.id,
          materialName: this.material.name,
          uniformName,
          kind,
          value
        },
        bubbles: true,
        composed: true
      })
    );
  }

  private _scalarChangeHandler(uniform: MaterialUniform) {
    return (evt: Event) => {
      const kind = uniform.typeName === 'float' ? 'float' : 'int';
      this._dispatchUniformChange(uniform.name, kind, Number((evt.target as SlInput).value) || 0);
    };
  }

  private _boolChangeHandler(uniform: MaterialUniform) {
    return (evt: Event) => {
      this._dispatchUniformChange(uniform.name, 'bool', (evt.target as SlSwitch).checked);
    };
  }

  private _vecChangeHandler(uniform: MaterialUniform) {
    return () => {
      const inputs = Array.from(
        this.shadowRoot!.querySelectorAll<SlInput>(`sl-input[data-uniform="${CSS.escape(uniform.name)}"]`)
      ).sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));
      const values = inputs.map((input) => Number(input.value) || 0);
      this._dispatchUniformChange(uniform.name, 'floatArray', values);
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
        this._dispatchUniformChange(uniform.name, 'floatArray', [+match[1] / 255, +match[2] / 255, +match[3] / 255, alpha]);
      }
    };
  }

  private _materialColorChangeHandler() {
    return (evt: Event) => {
      const rgba = (evt.target as SlColorPicker).getFormattedValue('rgba');
      const match = rgba.match(/rgba?\((\d+),?\s*(\d+),?\s*(\d+)(?:,?\s*\/?\s*([\d.%]+))?\)/);
      if (match) {
        let alpha = match[4] !== undefined ? parseFloat(match[4]) : 1;
        if (match[4]?.includes('%')) {
          alpha = alpha / 100;
        }
        this._dispatchUniformChange('u_color', 'color', { r: +match[1], g: +match[2], b: +match[3], a: alpha });
      }
    };
  }

  private _renderEditor(uniform: MaterialUniform) {
    const value = uniform.value;
    switch (uniform.typeName) {
      case 'bool':
        return html`
          <sl-switch
            class="uniform-editor"
            .checked=${value === true}
            @sl-change=${this._boolChangeHandler(uniform)}
          ></sl-switch>
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
            ${components.slice(0, dim).map(
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

  private _renderUniformsTable(uniforms: MaterialUniform[], editable: boolean) {
    if (uniforms.length === 0) {
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
            uniforms,
            (uniform) => uniform.name,
            (uniform) => html`
              <tr>
                <td class="uniform-name">${uniform.name}</td>
                <td class="uniform-type">${uniform.typeName}</td>
                <td>${editable && uniform.editable ? this._renderEditor(uniform) : this._renderValue(uniform)}</td>
              </tr>
            `
          )}
        </tbody>
      </table>
    `;
  }

  private _previewSizeHandler = (evt: Event) => {
    this._previewSize = Number((evt.target as SlRange).value) || 192;
  };

  private _inspectTexture(sampler: string) {
    return () => {
      this._zoom = 0;
      this._inspectedSampler = sampler;
    };
  }

  private _closeInspectHandler = (evt: Event) => {
    // sl-hide bubbles from nested shoelace components too; only react to the dialog itself
    if ((evt.target as HTMLElement).tagName === 'SL-DIALOG') {
      this._inspectedSampler = null;
    }
  };

  private _renderTextures() {
    if (!this.material) {
      return nothing;
    }
    const detailTextures = this.detail?.textures ?? [];
    const images = this.material.images;
    if (images.length === 0) {
      return html`<div>No textures</div>`;
    }
    return html`
      <div class="textures-toolbar">
        <span class="label">Preview size</span>
        <sl-range
          min="64"
          max="512"
          step="32"
          .value=${this._previewSize}
          @sl-input=${this._previewSizeHandler}
        ></sl-range>
      </div>
      <div class="textures" style="--preview-size: ${this._previewSize}px">
        ${repeat(
          images,
          (image) => image.sampler,
          (image) => {
            const texture = detailTextures.find((t) => t.sampler === image.sampler);
            const clickable = !!texture?.dataUrl;
            const sampling = formatSampling(image) ?? (texture ? formatSampling(texture) : null);
            const placeholderText =
              image.sampler === 'u_screen_texture' ? 'live screen' : image.loaded ? 'no preview' : 'not loaded';
            return html`
              <div
                class="texture ${clickable ? 'clickable' : ''}"
                title=${clickable ? 'Click to inspect' : nothing}
                @click=${clickable ? this._inspectTexture(image.sampler) : nothing}
              >
                ${texture?.dataUrl
                  ? html`<img src=${texture.dataUrl} alt=${image.sampler} />`
                  : html`<div class="placeholder">${placeholderText}</div>`}
                <div class="meta">
                  <div class="sampler">
                    ${image.sampler}
                    ${image.builtIn
                      ? html`<sl-tag size="small">${image.slot !== undefined ? `slot ${image.slot}` : 'built-in'}</sl-tag>`
                      : nothing}
                  </div>
                  <div>${image.width}×${image.height}</div>
                  ${sampling ? html`<div title="filtering · wrapping">${sampling}</div>` : nothing}
                  ${image.label ? html`<div title=${image.label}>${image.label.split('/').pop()}</div>` : nothing}
                </div>
              </div>
            `;
          }
        )}
      </div>
    `;
  }

  private _renderInspectDialog() {
    const sampler = this._inspectedSampler;
    const texture = sampler ? this.detail?.textures.find((t) => t.sampler === sampler) : undefined;
    const image = sampler ? this.material?.images.find((i) => i.sampler === sampler) : undefined;
    const open = !!texture?.dataUrl;
    // zoom against the real texture dimensions so 1× is actual size even when
    // the captured thumbnail was downscaled
    const width = texture?.width || image?.width || 0;
    const height = texture?.height || image?.height || 0;
    const label = texture?.label || image?.label || '';
    const sampling = (image ? formatSampling(image) : null) ?? (texture ? formatSampling(texture) : null);
    const zoom = this._zoom;
    return html`
      <sl-dialog
        class="texture-inspect"
        label=${sampler ?? ''}
        ?open=${open}
        @sl-hide=${this._closeInspectHandler}
      >
        ${open
          ? html`
              <div class="inspect-toolbar">
                <sl-button-group label="Zoom">
                  ${[0, 1, 2, 4, 8].map(
                    (z) => html`
                      <sl-button
                        size="small"
                        variant=${zoom === z ? 'primary' : 'default'}
                        @click=${() => (this._zoom = z)}
                      >
                        ${z === 0 ? 'Fit' : `${z}×`}
                      </sl-button>
                    `
                  )}
                </sl-button-group>
                <span class="inspect-meta"
                  >${width}×${height}${sampling ? ` — ${sampling}` : ''}${label ? ` — ${label}` : ''}</span
                >
              </div>
              <div class="inspect-viewport">
                <img
                  class=${zoom === 0 ? 'fit' : ''}
                  src=${texture.dataUrl!}
                  alt=${sampler!}
                  style=${zoom === 0 ? nothing : `width: ${width * zoom}px; height: ${height * zoom}px;`}
                />
              </div>
            `
          : nothing}
      </sl-dialog>
    `;
  }

  private _renderSources() {
    if (!this.detail) {
      return html`<div>Loading sources…</div>`;
    }
    return html`
      ${this.detail.processedByGlslTag ? html`<sl-tag size="small" variant="primary">glsl tag processed</sl-tag>` : nothing}
      <sl-details summary="Vertex Source">
        <pre class="source"><code
          >${guard([this.detail.vertexSource], () =>
            this.detail?.vertexSource ? highlightGlsl(this.detail.vertexSource) : '(empty)'
          )}</code
        ></pre>
      </sl-details>
      <sl-details summary="Fragment Source" open>
        <pre class="source"><code
          >${guard([this.detail.fragmentSource], () =>
            this.detail?.fragmentSource ? highlightGlsl(this.detail.fragmentSource) : '(empty)'
          )}</code
        ></pre>
      </sl-details>
    `;
  }

  override render() {
    const material = this.material;
    if (!material) {
      return html`<div class="section">Select a material to inspect</div>`;
    }
    const customUniforms = material.uniforms.filter((u) => !u.builtIn);
    const builtInUniforms = material.uniforms.filter((u) => u.builtIn);
    const color = material.color;
    return html`
      <h2>${material.name}</h2>
      <div class="section">
        <div class="info-row"><span class="label">Id:</span>${material.id}</div>
        <div class="info-row">
          <span class="label">Compiled:</span>${material.compiled ? 'yes' : 'no'}
          ${material.isUsingScreenTexture ? html`<sl-tag size="small">screen texture</sl-tag>` : nothing}
          ${material.isOverridingGraphic ? html`<sl-tag size="small">overrides u_graphic</sl-tag>` : nothing}
        </div>
        ${color
          ? html`
              <div class="info-row">
                <span class="label">Color (u_color):</span>
                <span
                  class="swatch"
                  style="background-color: rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})"
                ></span>
                <sl-color-picker
                  class="uniform-editor"
                  size="small"
                  opacity
                  .value=${`rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`}
                  @sl-change=${this._materialColorChangeHandler()}
                ></sl-color-picker>
              </div>
            `
          : nothing}
      </div>

      <h3>Custom Uniforms</h3>
      <div class="section">${this._renderUniformsTable(customUniforms, true)}</div>

      <h3>Built-in Uniforms</h3>
      <div class="section">${this._renderUniformsTable(builtInUniforms, false)}</div>

      <h3>Textures</h3>
      <div class="section">${this._renderTextures()}</div>

      <h3>Shader Source</h3>
      <div class="section">${this._renderSources()}</div>

      ${this._renderInspectDialog()}
    `;
  }
}
