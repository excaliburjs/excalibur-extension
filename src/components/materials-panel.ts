import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { colors } from '../colors';
import { common } from '../common';
import './material-detail';
import './pipeline-view';
import type { MaterialDetail, MaterialsState, MaterialSummary } from './material-detail';
import type { PipelineDetail, PipelineDetailRequest, PostProcessorsState, PostProcessorSummary } from './pipeline-view';

export interface MaterialSelected {
  materialId: number;
  materialName: string;
  key: string;
}

/**
 * Materials/PostProcessors tab: a two-section list (materials found in the
 * game, postprocessors on the graphics context) plus a detail view for the
 * selected item. Owns the live framebuffer-capture poll: while the Live
 * toggle is on, the tab visible, and a capturable item selected, it re-issues
 * a framebuffers-only pipeline-detail request every 500ms.
 * @event material-selected - Emitted when a material needs its detail fetched
 * @event pipeline-detail-request - Emitted when pipeline sources/captures are needed
 * @event uniform-change - Re-dispatched from material-detail (composed)
 * @event pass-uniform-change - Re-dispatched from pipeline-view (composed)
 */
@customElement('materials-panel')
export class MaterialsPanel extends LitElement {
  static styles = [
    colors,
    common,
    css`
      :host {
        display: block;
      }

      .layout {
        display: flex;
        gap: 10px;
        align-items: flex-start;
      }

      .material-list {
        min-width: 220px;
        background-color: var(--panel-color);
        padding: 10px;
      }

      .material-list button {
        display: block;
        width: 100%;
        text-align: left;
        background: none;
        border: none;
        color: #ccc;
        padding: 8px;
        cursor: pointer;
        font-size: 14px;
        font-family: inherit;
      }

      .material-list button:hover {
        background-color: var(--green-highlight);
      }

      .material-list button.selected {
        background-color: var(--blue-background);
        border-left: 3px solid var(--ex-blue-accent);
      }

      .material-list .id {
        color: #666;
        font-size: 12px;
        margin-left: 5px;
      }

      .material-list sl-tag {
        margin-left: 5px;
      }

      .detail {
        flex: 1;
        min-width: 0;
      }

      .empty {
        padding: 20px;
        color: #888;
      }

      .hint {
        font-size: 12px;
        color: #666;
        margin-top: 10px;
      }

      .pp-header .label {
        color: #888;
        margin-right: 5px;
      }
    `
  ];

  override shouldUpdate() {
    return this.isConnected;
  }

  @property({ type: Object })
  materials: MaterialsState = { source: 'scan', list: [] };

  @property({ type: Object })
  postprocessors: PostProcessorsState = { list: [] };

  @property({ type: Object })
  details: Record<string, MaterialDetail> = {};

  @property({ type: Object })
  pipelineDetails: Record<string, PipelineDetail> = {};

  /** True while the Materials/PostProcessors tab is the visible tab. */
  @property({ type: Boolean })
  active = false;

  /**
   * When true, the running Excalibur engine is not newer than v0.32.0 and the
   * Materials tab is replaced with a version-warning message.
   */
  @property({ type: Boolean })
  unsupported = false;

  /**
   * Namespaced selection: `mat:<materialKey>` or `pp:<ppKey>`.
   */
  @state()
  private _selectedKey: string | null = null;

  /** Whether the live framebuffer-capture poll is on (pipeline-view toggle). */
  @state()
  private _live = false;

  /**
   * The sourceHash each material key's detail was last fetched at; a change
   * means the shader was swapped/recompiled and the detail must be re-fetched.
   */
  private _fetchedHash: Record<string, number> = {};

  /**
   * The sourceHash each namespaced key's pipeline detail (sources) was last
   * fetched at. Framebuffer refreshes deliberately do not touch this map —
   * captures are per-frame data with their own refresh path.
   */
  private _fetchedPipelineHash: Record<string, number> = {};

  private _liveTimer: ReturnType<typeof setInterval> | null = null;

  private get _selectedMaterial(): MaterialSummary | null {
    if (!this._selectedKey?.startsWith('mat:')) {
      return null;
    }
    const key = this._selectedKey.slice(4);
    return this.materials.list.find((m) => m.key === key) ?? null;
  }

  private get _selectedPostProcessor(): PostProcessorSummary | null {
    if (!this._selectedKey?.startsWith('pp:')) {
      return null;
    }
    const key = this._selectedKey.slice(3);
    return this.postprocessors.list.find((p) => p.key === key) ?? null;
  }

  private _select(namespacedKey: string) {
    this._selectedKey = namespacedKey;
  }

  override willUpdate() {
    // Reconcile the selection before render: auto-select the first item, and
    // fall back when the selected one disappears (scene change, hot reload,
    // registry rebuild) so `updated()` fetches detail for the item actually
    // being displayed
    const allKeys = [...this.materials.list.map((m) => `mat:${m.key}`), ...this.postprocessors.list.map((p) => `pp:${p.key}`)];
    if (allKeys.length > 0 && (!this._selectedKey || !allKeys.includes(this._selectedKey))) {
      this._selectedKey = allKeys[0];
    }
  }

  /** Emits a pipeline-detail request up to app-main. */
  private _requestPipelineDetail(request: PipelineDetailRequest) {
    this.dispatchEvent(
      new CustomEvent<PipelineDetailRequest>('pipeline-detail-request', {
        detail: request,
        bubbles: true,
        composed: true
      })
    );
  }

  /** True when the current selection has framebuffer captures worth polling. */
  private get _selectedSupportsCapture(): boolean {
    return !!(this._selectedMaterial?.pipeline || this._selectedPostProcessor);
  }

  /** The request describing the current selection, or null. */
  private _selectionRequest(includeSources: boolean): PipelineDetailRequest | null {
    const material = this._selectedMaterial;
    if (material?.pipeline) {
      return {
        kind: 'material',
        ownerId: material.id,
        ownerName: material.name,
        key: `mat:${material.key}`,
        includeSources,
        includeFramebuffers: true
      };
    }
    const pp = this._selectedPostProcessor;
    if (pp) {
      return {
        kind: 'postprocessor',
        ownerId: pp.id,
        ownerName: pp.name,
        key: `pp:${pp.key}`,
        includeSources,
        includeFramebuffers: true
      };
    }
    return null;
  }

  private _liveToggleHandler = (evt: CustomEvent<{ live: boolean }>) => {
    evt.stopPropagation();
    this._live = evt.detail.live;
  };

  /** Starts/stops the 500ms live capture poll to match the current state. */
  private _syncLiveTimer() {
    const shouldRun = this._live && this.active && this._selectedSupportsCapture;
    if (shouldRun && this._liveTimer === null) {
      this._liveTimer = setInterval(() => {
        const request = this._selectionRequest(false);
        if (request) {
          this._requestPipelineDetail(request);
        }
      }, 500);
    } else if (!shouldRun && this._liveTimer !== null) {
      clearInterval(this._liveTimer);
      this._liveTimer = null;
    }
  }

  override disconnectedCallback(): void {
    if (this._liveTimer !== null) {
      clearInterval(this._liveTimer);
      this._liveTimer = null;
    }
    super.disconnectedCallback();
  }

  override updated() {
    // Fetch (or re-fetch on source change) the selected material's detail
    const material = this._selectedMaterial;
    if (material && this._fetchedHash[material.key] !== material.sourceHash) {
      this._fetchedHash[material.key] = material.sourceHash;
      this.dispatchEvent(
        new CustomEvent<MaterialSelected>('material-selected', {
          detail: {
            materialId: material.id,
            materialName: material.name,
            key: material.key
          },
          bubbles: true,
          composed: true
        })
      );
    }

    // Fetch pipeline sources + first captures when the selection's pass
    // sources change (the sourceHash folds pass sources in)
    const request = this._selectionRequest(true);
    if (request) {
      const hash = material?.pipeline ? material.sourceHash : (this._selectedPostProcessor?.sourceHash ?? 0);
      if (this._fetchedPipelineHash[request.key] !== hash) {
        this._fetchedPipelineHash[request.key] = hash;
        this._requestPipelineDetail(request);
      }
    }

    this._syncLiveTimer();
  }

  private _renderList(selectedKey: string | null) {
    const materials = this.materials.list;
    const pps = this.postprocessors.list;
    return html`
      <div class="material-list">
        <h3>Materials (${materials.length})</h3>
        ${repeat(
          materials,
          (material) => `mat:${material.key}`,
          (material) => html`
            <button class=${`mat:${material.key}` === selectedKey ? 'selected' : ''} @click=${() => this._select(`mat:${material.key}`)}>
              ${material.name}<span class="id">#${material.id}</span>
              ${material.pipeline ? html`<sl-tag size="small" variant="primary">pipeline</sl-tag>` : nothing}
            </button>
          `
        )}
        ${materials.length === 0 ? html`<div class="hint">None found</div>` : nothing}
        ${this.materials.source === 'scan'
          ? html`<div class="hint">Discovered by entity scan; unattached materials are not visible.</div>`
          : nothing}
        <h3>Post Processors (${pps.length})</h3>
        ${repeat(
          pps,
          (pp) => `pp:${pp.key}`,
          (pp) => html`
            <button class=${`pp:${pp.key}` === selectedKey ? 'selected' : ''} @click=${() => this._select(`pp:${pp.key}`)}>
              ${pp.name}<span class="id">#${pp.id}</span>
              ${pp.kind === 'pipeline' ? html`<sl-tag size="small" variant="primary">pipeline</sl-tag>` : nothing}
              ${pp.kind === 'legacy' ? html`<sl-tag size="small">legacy</sl-tag>` : nothing}
            </button>
          `
        )}
        ${pps.length === 0 ? html`<div class="hint">None found</div>` : nothing}
      </div>
    `;
  }

  private _renderPostProcessorDetail(pp: PostProcessorSummary) {
    return html`
      <h2>${pp.name}</h2>
      <div class="section pp-header">
        <div><span class="label">Kind:</span>${pp.kind}</div>
        <div><span class="label">Compiled:</span>${pp.compiled ? 'yes' : 'no'}</div>
      </div>
      <h3>Pipeline</h3>
      <div class="section">
        <pipeline-view
          .summary=${pp.pipeline}
          .owner=${{ kind: 'postprocessor' as const, id: pp.id, name: pp.name, key: `pp:${pp.key}` }}
          .detail=${this.pipelineDetails[`pp:${pp.key}`] ?? null}
          .live=${this._live}
          @live-capture-toggle=${this._liveToggleHandler}
        ></pipeline-view>
      </div>
    `;
  }

  override render() {
    if (this.unsupported) {
      return html`
        <div class="empty section">
          This panel requires Excalibur newer than v0.32.0.
          <div class="hint">Upgrade the engine to use the Materials tab.</div>
        </div>
      `;
    }

    if (this.materials.list.length === 0 && this.postprocessors.list.length === 0) {
      return html`
        <div class="empty section">
          No materials or postprocessors found in the running game.
          ${this.materials.source === 'scan'
            ? html`<div class="hint">
                Materials are discovered by scanning scene entities. Materials not attached to an entity require a newer version of
                Excalibur to appear here.
              </div>`
            : nothing}
        </div>
      `;
    }

    const material = this._selectedMaterial;
    const pp = this._selectedPostProcessor;

    return html`
      <div class="layout">
        ${this._renderList(this._selectedKey)}
        <div class="detail">
          ${material
            ? html`
                <material-detail
                  .material=${material}
                  .detail=${this.details[material.key] ?? null}
                  .pipelineDetail=${this.pipelineDetails[`mat:${material.key}`] ?? null}
                  .pipelineLive=${this._live}
                  @live-capture-toggle=${this._liveToggleHandler}
                ></material-detail>
              `
            : nothing}
          ${pp ? this._renderPostProcessorDetail(pp) : nothing}
        </div>
      </div>
    `;
  }
}
