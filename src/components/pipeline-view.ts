import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { guard } from 'lit/directives/guard.js';
import { colors } from '../colors';
import { common } from '../common';
import { highlightGlsl } from '../glsl-highlight';
import type { MaterialUniform } from './material-detail';
import type { UniformEdit } from './uniform-table';
import './uniform-table';

/**
 * Types for shader-pipeline introspection (Excalibur 0.33+, PR #3828),
 * shared by the heartbeat summaries built in `src/page/inject.ts`, the
 * on-demand detail from `src/page/pipeline.ts`, and the panel UI.
 */

/**
 * One pass of a pipeline as carried in the heartbeat: metadata and live
 * uniform values only — sources and framebuffer pixels ride the on-demand
 * detail instead.
 */
export interface PassSummary {
  index: number;
  name: string;
  /** Intermediate framebuffer scale relative to the pipeline source. */
  scale: number;
  /** ImageFiltering string, e.g. 'Blended' | 'Pixel'; '' when unknown. */
  filtering: string;
  /** False until the pass shader compiles on its first draw. */
  compiled: boolean;
  uniforms: MaterialUniform[];
}

/**
 * Heartbeat summary of a pipeline attached to a material or postprocessor.
 */
export interface PipelineSummary {
  /** Extra render-area padding (materials only; 0 for postprocessors). */
  padding: number;
  /** True when the pass ladder could not resolve passes (custom process()). */
  opaque: boolean;
  pipelineName: string;
  passes: PassSummary[];
}

/**
 * Heartbeat summary of one postprocessor found on the graphics context.
 */
export interface PostProcessorSummary {
  /** Page-session-stable stamped id (postprocessors have no engine id). */
  id: number;
  name: string;
  /** `${name}#${id}` — stable list/selection key across heartbeats. */
  key: string;
  kind: 'pipeline' | 'legacy' | 'opaque';
  compiled: boolean;
  /** Hash of all pass sources (pipeline) or the getShader() source (legacy). */
  sourceHash: number;
  /** Null for legacy/opaque postprocessors. */
  pipeline: PipelineSummary | null;
}

/**
 * The postprocessor list carried in the heartbeat while the
 * Materials/PostProcessors tab is visible.
 */
export interface PostProcessorsState {
  list: PostProcessorSummary[];
}

/**
 * One captured framebuffer thumbnail in the pipeline data flow.
 */
export interface FramebufferCapture {
  stage: 'seed' | 'intermediate' | 'output';
  /** For 'intermediate': index i means "output of pass i"; null otherwise. */
  passIndex: number | null;
  width: number;
  height: number;
  /** Null when capture failed or the framebuffer was never drawn. */
  dataUrl: string | null;
  /** Short reason when dataUrl is null, e.g. 'not yet drawn'. */
  note?: string;
}

/**
 * On-demand heavy pipeline payload (reply to ex-debug:get-pipeline-detail).
 * `passes` is present only when the request asked for sources, and
 * `framebuffers` only when it asked for captures — the panel merges partial
 * replies so a framebuffer-only refresh never drops cached sources.
 */
export interface PipelineDetail {
  /** Namespaced cache key: `mat:<materialKey>` or `pp:<ppKey>`. */
  key: string;
  kind: 'material' | 'postprocessor';
  /** True for a 0.32-style single-shader postprocessor. */
  legacy?: boolean;
  passes?: { index: number; name: string; fragmentSource: string }[];
  framebuffers?: FramebufferCapture[];
  /** Page-realm Date.now() at capture time, for the "captured Xs ago" label. */
  capturedAt: number;
}

/**
 * A pass-uniform edit requested by the panel (ex-debug:update-pass-uniform).
 */
export interface PassUniformChange {
  ownerKind: 'material' | 'postprocessor';
  ownerId: number;
  ownerName: string;
  passIndex: number;
  uniformName: string;
  valueKind: 'float' | 'int' | 'bool' | 'floatArray';
  value: number | boolean | number[];
}

/**
 * Query for the on-demand pipeline detail (ex-debug:get-pipeline-detail).
 */
export interface PipelineDetailRequest {
  kind: 'material' | 'postprocessor';
  ownerId: number;
  ownerName: string;
  /** Namespaced cache key the reply should carry (see PipelineDetail.key). */
  key: string;
  includeSources: boolean;
  includeFramebuffers: boolean;
}

/**
 * The pipeline item a `<pipeline-view>` is showing, used to address detail
 * requests and pass-uniform edits.
 */
export interface PipelineOwner {
  kind: 'material' | 'postprocessor';
  id: number;
  name: string;
  /** Namespaced detail cache key (`mat:...` / `pp:...`). */
  key: string;
}

/**
 * Visualizes a shader pipeline as data flow: the seed framebuffer (materials),
 * then each pass — name/scale/filtering, GLSL-highlighted fragment source,
 * editable uniforms — followed by its intermediate framebuffer capture, down
 * to the output. Also renders legacy (single-shader) postprocessors.
 *
 * Framebuffer captures are point-in-time: the toolbar's Refresh re-captures
 * once and the Live toggle asks the host panel to poll.
 * @event pipeline-detail-request - Ask the host to fetch detail (refresh path)
 * @event pass-uniform-change - A pass uniform was edited
 * @event live-capture-toggle - The Live capture toggle changed
 */
@customElement('pipeline-view')
export class PipelineView extends LitElement {
  static styles = [
    colors,
    common,
    css`
      :host {
        display: block;
      }

      .toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
      }

      .toolbar .captured {
        color: #888;
        font-size: 12px;
      }

      .flow-arrow {
        color: #666;
        text-align: left;
        padding: 2px 0 2px 40px;
        font-size: 14px;
      }

      .pass {
        background-color: var(--darker-panel-color);
        padding: 10px;
        border-left: 3px solid var(--ex-blue-accent, #4a9eda);
      }

      .pass-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .pass-name {
        font-family: monospace;
        color: var(--blue-text);
      }

      .pass-meta {
        color: #888;
        font-size: 12px;
      }

      .fb {
        display: inline-block;
        background-color: var(--darker-panel-color);
        padding: 8px;
        text-align: center;
      }

      .fb.clickable {
        cursor: zoom-in;
      }

      .fb.clickable:hover {
        outline: 1px solid #555;
      }

      .fb img {
        width: var(--fb-preview-size, 160px);
        height: var(--fb-preview-size, 160px);
        object-fit: contain;
        image-rendering: pixelated;
        background: repeating-conic-gradient(#333 0% 25%, #444 0% 50%) 0 0 / 16px 16px;
      }

      .fb .placeholder {
        width: var(--fb-preview-size, 160px);
        height: var(--fb-preview-size, 160px);
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #2a2a2a;
        color: #666;
        font-size: 12px;
      }

      .fb .meta {
        font-size: 12px;
        color: #888;
        margin-top: 4px;
      }

      .fb .stage {
        font-family: monospace;
        color: var(--blue-text);
      }

      .fb-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      pre.source {
        background-color: var(--panel-color);
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
        margin-bottom: 8px;
      }

      .note {
        color: #888;
        font-size: 12px;
      }

      sl-dialog.fb-inspect {
        --width: calc(100vw - 32px);
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
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      h4 {
        margin: 10px 0 5px 0;
      }
    `
  ];

  override shouldUpdate() {
    return this.isConnected;
  }

  @property({ type: Object })
  summary: PipelineSummary | null = null;

  @property({ type: Object })
  owner: PipelineOwner | null = null;

  @property({ type: Object })
  detail: PipelineDetail | null = null;

  /** Whether the host panel's live capture poll is running. */
  @property({ type: Boolean })
  live = false;

  /**
   * Stage+passIndex key of the framebuffer open in the inspect dialog, or
   * null when closed. Kept in state so it survives 5Hz re-renders.
   */
  @state()
  private _inspectedFb: string | null = null;

  /**
   * Stable key for one framebuffer capture entry; includes the list position
   * so unindexed internal framebuffers (e.g. bloom's ladders) stay distinct.
   */
  private _fbKey(fb: FramebufferCapture): string {
    const position = (this.detail?.framebuffers ?? []).indexOf(fb);
    return `${fb.stage}#${fb.passIndex ?? ''}#${position}`;
  }

  private _requestDetail(includeSources: boolean) {
    if (!this.owner) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<PipelineDetailRequest>('pipeline-detail-request', {
        detail: {
          kind: this.owner.kind,
          ownerId: this.owner.id,
          ownerName: this.owner.name,
          key: this.owner.key,
          includeSources,
          includeFramebuffers: true
        },
        bubbles: true,
        composed: true
      })
    );
  }

  private _refreshHandler = () => {
    this._requestDetail(false);
  };

  private _liveToggleHandler = (evt: Event) => {
    const checked = !!(evt.target as HTMLInputElement & { checked: boolean }).checked;
    this.dispatchEvent(
      new CustomEvent<{ live: boolean }>('live-capture-toggle', {
        detail: { live: checked },
        bubbles: true,
        composed: true
      })
    );
  };

  /** Re-wraps a uniform-edit from a pass's table into a PassUniformChange. */
  private _passUniformEditHandler(passIndex: number) {
    return (evt: CustomEvent<UniformEdit>) => {
      evt.stopPropagation();
      if (!this.owner) {
        return;
      }
      this.dispatchEvent(
        new CustomEvent<PassUniformChange>('pass-uniform-change', {
          detail: {
            ownerKind: this.owner.kind,
            ownerId: this.owner.id,
            ownerName: this.owner.name,
            passIndex,
            uniformName: evt.detail.uniformName,
            valueKind: evt.detail.kind,
            value: evt.detail.value
          },
          bubbles: true,
          composed: true
        })
      );
    };
  }

  private _inspectFb(key: string) {
    return () => {
      this._inspectedFb = key;
    };
  }

  private _closeInspectHandler = (evt: Event) => {
    // sl-hide bubbles from nested shoelace components too; only react to the dialog itself
    if ((evt.target as HTMLElement).tagName === 'SL-DIALOG') {
      this._inspectedFb = null;
    }
  };

  /** Renders one framebuffer capture tile (or a placeholder). */
  private _renderFb(fb: FramebufferCapture | undefined, label: string) {
    if (!fb) {
      return html`
        <div class="fb">
          <div class="placeholder">no capture</div>
          <div class="meta"><span class="stage">${label}</span></div>
        </div>
      `;
    }
    const key = this._fbKey(fb);
    const clickable = !!fb.dataUrl;
    return html`
      <div
        class="fb ${clickable ? 'clickable' : ''}"
        title=${clickable ? 'Click to inspect' : nothing}
        @click=${clickable ? this._inspectFb(key) : nothing}
      >
        ${fb.dataUrl ? html`<img src=${fb.dataUrl} alt=${label} />` : html`<div class="placeholder">${fb.note ?? 'no capture'}</div>`}
        <div class="meta">
          <span class="stage">${label}</span>
          ${fb.width > 0 ? html`<div>${fb.width}×${fb.height}</div>` : nothing}
        </div>
      </div>
    `;
  }

  private _renderInspectDialog() {
    const key = this._inspectedFb;
    const fb = key ? (this.detail?.framebuffers ?? []).find((f) => this._fbKey(f) === key) : undefined;
    const open = !!fb?.dataUrl;
    return html`
      <sl-dialog class="fb-inspect" label=${key ?? ''} ?open=${open} @sl-hide=${this._closeInspectHandler}>
        ${open ? html`<div class="inspect-viewport"><img src=${fb!.dataUrl!} alt=${key!} /></div>` : nothing}
      </sl-dialog>
    `;
  }

  /** Renders the fragment source of a pass, GLSL highlighted and cached. */
  private _renderPassSource(passIndex: number) {
    const source = (this.detail?.passes ?? []).find((p) => p.index === passIndex)?.fragmentSource;
    if (source === undefined) {
      return html`<div class="note">Loading source…</div>`;
    }
    return html`
      <sl-details summary="Fragment Source">
        <pre class="source"><code>${guard([source], () => (source ? highlightGlsl(source) : '(empty)'))}</code></pre>
      </sl-details>
    `;
  }

  private _renderToolbar() {
    const capturedAt = this.detail?.capturedAt;
    const age = capturedAt ? Math.max(0, Math.round((Date.now() - capturedAt) / 1000)) : null;
    return html`
      <div class="toolbar">
        <sl-button size="small" @click=${this._refreshHandler}>Refresh captures</sl-button>
        <sl-switch size="small" .checked=${this.live} @sl-change=${this._liveToggleHandler}>Live</sl-switch>
        ${age !== null ? html`<span class="captured">captured ${age}s ago</span>` : nothing}
      </div>
    `;
  }

  private _renderPass(pass: PassSummary) {
    return html`
      <div class="pass">
        <div class="pass-header">
          <span class="pass-name">${pass.name}</span>
          ${pass.scale !== 1 ? html`<span class="pass-meta">×${pass.scale} scale</span>` : nothing}
          ${pass.filtering ? html`<span class="pass-meta">${pass.filtering}</span>` : nothing}
          ${pass.compiled ? nothing : html`<sl-tag size="small" variant="warning">not compiled yet</sl-tag>`}
        </div>
        ${this._renderPassSource(pass.index)}
        <uniform-table .uniforms=${pass.uniforms} editable @uniform-edit=${this._passUniformEditHandler(pass.index)}></uniform-table>
      </div>
    `;
  }

  override render() {
    const framebuffers = this.detail?.framebuffers ?? [];
    const seed = framebuffers.find((fb) => fb.stage === 'seed');
    const output = framebuffers.find((fb) => fb.stage === 'output');
    const unindexed = framebuffers.filter((fb) => fb.stage === 'intermediate' && fb.passIndex === null);

    // legacy postprocessor: one screen shader, no pass chain
    if (!this.summary || (this.detail?.legacy && this.summary.passes.length === 0)) {
      if (this.detail?.legacy) {
        return html`
          ${this._renderToolbar()}
          <div class="note">Legacy postprocessor (single screen shader)</div>
          ${this._renderPassSource(0)} ${output ? html`<div class="fb-strip">${this._renderFb(output, 'output')}</div>` : nothing}
          ${this._renderInspectDialog()}
        `;
      }
      return html`<div class="note">No pipeline</div>`;
    }

    if (this.summary.opaque) {
      return html`
        ${this._renderToolbar()}
        <div class="note">
          ${this.summary.pipelineName || 'Custom pipeline'} — passes are not introspectable (custom process() implementation)
        </div>
        ${output ? html`<div class="fb-strip">${this._renderFb(output, 'output')}</div>` : nothing} ${this._renderInspectDialog()}
      `;
    }

    return html`
      ${this._renderToolbar()} ${this.summary.padding > 0 ? html`<div class="note">padding: ${this.summary.padding}px</div>` : nothing}
      ${seed
        ? html`${this._renderFb(seed, 'seed')}
            <div class="flow-arrow">↓</div>`
        : nothing}
      ${repeat(
        this.summary.passes,
        (pass) => `pass-${pass.index}`,
        (pass, i) => {
          const intermediate = framebuffers.find((fb) => fb.stage === 'intermediate' && fb.passIndex === pass.index);
          const isLast = i === this.summary!.passes.length - 1;
          return html`
            ${this._renderPass(pass)}
            ${!isLast || intermediate
              ? html`
                  <div class="flow-arrow">↓</div>
                  ${intermediate
                    ? html`${this._renderFb(intermediate, `pass ${pass.index} output`)}
                        <div class="flow-arrow">↓</div>`
                    : nothing}
                `
              : nothing}
          `;
        }
      )}
      ${unindexed.length > 0
        ? html`
            <h4>Internal framebuffers</h4>
            <div class="fb-strip">${unindexed.map((fb, i) => this._renderFb(fb, `internal ${i}`))}</div>
          `
        : nothing}
      ${output
        ? html`<div class="flow-arrow">↓</div>
            ${this._renderFb(output, 'output')}`
        : nothing}
      ${this._renderInspectDialog()}
    `;
  }
}
