import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { guard } from 'lit/directives/guard.js';
import { colors } from '../colors';
import { common } from '../common';
import { highlightGlsl } from '../glsl-highlight';
import { formatSampling } from '../format';
import type { SlColorPicker, SlRange } from '@shoelace-style/shoelace';
import type { PipelineDetail, PipelineSummary } from './pipeline-view';
import type { UniformEdit } from './uniform-table';
import './uniform-table';
import './pipeline-view';

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
  /** Present when the material has a multi-pass pipeline (0.33+). */
  pipeline?: PipelineSummary;
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
        background: repeating-conic-gradient(#333 0% 25%, #444 0% 50%) 0 0 / 16px 16px;
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
        background: repeating-conic-gradient(#333 0% 25%, #444 0% 50%) 0 0 / 16px 16px;
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

  /** On-demand pipeline sources/captures for this material, when it has one. */
  @property({ type: Object })
  pipelineDetail: PipelineDetail | null = null;

  /** Whether the host panel's live framebuffer-capture poll is running. */
  @property({ type: Boolean })
  pipelineLive = false;

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

  /**
   * Re-wraps a generic uniform-edit from a child `<uniform-table>` into the
   * material-addressed UniformChange this component's consumers expect.
   */
  private _uniformEditHandler = (evt: CustomEvent<UniformEdit>) => {
    evt.stopPropagation();
    this._dispatchUniformChange(evt.detail.uniformName, evt.detail.kind, evt.detail.value);
  };

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
        <sl-range min="64" max="512" step="32" .value=${this._previewSize} @sl-input=${this._previewSizeHandler}></sl-range>
      </div>
      <div class="textures" style="--preview-size: ${this._previewSize}px">
        ${repeat(
          images,
          (image) => image.sampler,
          (image) => {
            const texture = detailTextures.find((t) => t.sampler === image.sampler);
            const clickable = !!texture?.dataUrl;
            const sampling = formatSampling(image) ?? (texture ? formatSampling(texture) : null);
            const placeholderText = image.sampler === 'u_screen_texture' ? 'live screen' : image.loaded ? 'no preview' : 'not loaded';
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
      <sl-dialog class="texture-inspect" label=${sampler ?? ''} ?open=${open} @sl-hide=${this._closeInspectHandler}>
        ${open
          ? html`
              <div class="inspect-toolbar">
                <sl-button-group label="Zoom">
                  ${[0, 1, 2, 4, 8].map(
                    (z) => html`
                      <sl-button size="small" variant=${zoom === z ? 'primary' : 'default'} @click=${() => (this._zoom = z)}>
                        ${z === 0 ? 'Fit' : `${z}×`}
                      </sl-button>
                    `
                  )}
                </sl-button-group>
                <span class="inspect-meta">${width}×${height}${sampling ? ` — ${sampling}` : ''}${label ? ` — ${label}` : ''}</span>
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
                <span class="swatch" style="background-color: rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})"></span>
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
      <div class="section">
        <uniform-table .uniforms=${customUniforms} editable @uniform-edit=${this._uniformEditHandler}></uniform-table>
      </div>

      <h3>Built-in Uniforms</h3>
      <div class="section"><uniform-table .uniforms=${builtInUniforms}></uniform-table></div>

      <h3>Textures</h3>
      <div class="section">${this._renderTextures()}</div>

      ${material.pipeline
        ? html`
            <h3>Pipeline</h3>
            <div class="section">
              <pipeline-view
                .summary=${material.pipeline}
                .owner=${{ kind: 'material' as const, id: material.id, name: material.name, key: `mat:${material.key}` }}
                .detail=${this.pipelineDetail}
                .live=${this.pipelineLive}
              ></pipeline-view>
            </div>
          `
        : nothing}

      <h3>${material.pipeline ? 'Composite Shader' : 'Shader Source'}</h3>
      <div class="section">${this._renderSources()}</div>

      ${this._renderInspectDialog()}
    `;
  }
}
