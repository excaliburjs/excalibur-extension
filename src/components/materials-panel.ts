import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { colors } from '../colors';
import { common } from '../common';
import './material-detail';
import { MaterialDetail, MaterialsState, MaterialSummary } from './material-detail';

export interface MaterialSelected {
  materialId: number;
  materialName: string;
  key: string;
}

/**
 * Materials tab: list of materials found in the game plus a detail view for
 * the selected material.
 * @event material-selected - Emitted when a material needs its detail fetched
 * @event uniform-change - Re-dispatched from material-detail (composed)
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
    `
  ];

  override shouldUpdate() {
    return this.isConnected;
  }

  @property({ type: Object })
  materials: MaterialsState = { source: 'scan', list: [] };

  @property({ type: Object })
  details: Record<string, MaterialDetail> = {};

  /**
   * When true, the running Excalibur engine is not newer than v0.32.0 and the
   * Materials tab is replaced with a version-warning message.
   */
  @property({ type: Boolean })
  unsupported = false;

  @state()
  private _selectedKey: string | null = null;

  /**
   * The sourceHash each key's detail was last fetched at; a change means the
   * shader was swapped/recompiled and the detail must be re-fetched.
   */
  private _fetchedHash: Record<string, number> = {};

  private get _selected(): MaterialSummary | null {
    return this.materials.list.find((m) => m.key === this._selectedKey) ?? null;
  }

  private _select(material: MaterialSummary) {
    this._selectedKey = material.key;
  }

  override updated() {
    // Fetch (or re-fetch on source change) the selected material's detail
    const selected = this._selected;
    if (selected && this._fetchedHash[selected.key] !== selected.sourceHash) {
      this._fetchedHash[selected.key] = selected.sourceHash;
      this.dispatchEvent(
        new CustomEvent<MaterialSelected>('material-selected', {
          detail: {
            materialId: selected.id,
            materialName: selected.name,
            key: selected.key
          },
          bubbles: true,
          composed: true
        })
      );
    }
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

    const list = this.materials.list;
    if (list.length === 0) {
      return html`
        <div class="empty section">
          No materials found in the running game.
          ${this.materials.source === 'scan'
            ? html`<div class="hint">
                Materials are discovered by scanning scene entities. Materials not attached to an entity require a
                newer version of Excalibur to appear here.
              </div>`
            : nothing}
        </div>
      `;
    }

    // Auto-select the first material for convenience
    const selected = this._selected ?? list[0];
    if (this._selectedKey === null) {
      this._selectedKey = selected.key;
    }

    return html`
      <div class="layout">
        <div class="material-list">
          <h3>Materials (${list.length})</h3>
          ${repeat(
            list,
            (material) => material.key,
            (material) => html`
              <button
                class=${material.key === selected.key ? 'selected' : ''}
                @click=${() => this._select(material)}
              >
                ${material.name}<span class="id">#${material.id}</span>
              </button>
            `
          )}
          ${this.materials.source === 'scan'
            ? html`<div class="hint">Discovered by entity scan; unattached materials are not visible.</div>`
            : nothing}
        </div>
        <div class="detail">
          <material-detail .material=${selected} .detail=${this.details[selected.key] ?? null}></material-detail>
        </div>
      </div>
    `;
  }
}
