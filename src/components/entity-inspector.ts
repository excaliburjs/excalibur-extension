import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { colors } from '../colors';
import { common } from '../common';
import type { EntityGraphicsDetail, EntityPropertyUpdate, InspectedComponent, InspectedEntity } from '../protocol';
import type { SlInput, SlRange, SlSelect, SlSwitch } from '@shoelace-style/shoelace';

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

function asVector(value: unknown): { x: number; y: number } {
  const vec = value as { x?: unknown; y?: unknown } | null | undefined;
  return { x: asNumber(vec?.x), y: asNumber(vec?.y) };
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) {
    return n.toString();
  }
  return (Math.round(n * 10000) / 10000).toString();
}

function formatLoose(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'number') {
    return formatNumber(value);
  }
  if (value === 'Infinity') {
    return '∞';
  }
  if (value === '-Infinity') {
    return '-∞';
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatLoose).join(', ')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 2 && keys.includes('x') && keys.includes('y')) {
    return `(${formatLoose(obj.x)}, ${formatLoose(obj.y)})`;
  }
  return JSON.stringify(value);
}

const COLLISION_TYPES = ['Active', 'Fixed', 'Passive', 'PreventCollision'];

/**
 * Full-page dialog that deep-inspects one entity: serialized components with
 * purpose-built editors for transform/motion/graphics/body, a graphics
 * switcher, and parent/child navigation. Data flows in from the heartbeat
 * (entity) and the on-demand graphics fetch (graphics); edits flow up as
 * events and the next heartbeat reflects the page's actual state.
 * @event entity-property-change - Emitted when the user edits a property
 * @event use-graphic - Emitted when the user picks a graphic to show
 * @event inspect-entity - Emitted to navigate to a parent/child entity
 * @event inspector-closed - Emitted when the dialog is dismissed
 */
@customElement('entity-inspector')
export class EntityInspector extends LitElement {
  static styles = [
    colors,
    common,
    css`
      sl-dialog.entity-inspect {
        --width: calc(100vw - 32px);
      }

      .dialog-body {
        max-height: calc(100vh - 200px);
        overflow-y: auto;
      }

      .header-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 10px;
      }

      .header-row sl-input {
        min-width: 200px;
      }

      .hierarchy {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 5px;
        margin-bottom: 10px;
      }

      .hierarchy .label {
        color: #888;
        font-size: 12px;
        margin-right: 5px;
      }

      .hierarchy sl-tag {
        cursor: pointer;
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

      .prop-name {
        font-family: monospace;
        color: var(--blue-text);
        white-space: nowrap;
      }

      .prop-value {
        font-family: monospace;
      }

      .vec-editor {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .vec-editor sl-input {
        width: 110px;
      }

      .vec-editor .axis {
        color: #888;
        font-size: 12px;
      }

      sl-input[type='number'] {
        width: 130px;
      }

      sl-select {
        max-width: 200px;
      }

      .component-error {
        color: var(--red-text, #f66);
      }

      .graphics-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .graphic-tile {
        background-color: var(--darker-panel-color);
        padding: 10px;
        text-align: center;
        max-width: 148px;
        cursor: pointer;
      }

      .graphic-tile:hover {
        outline: 1px solid #555;
      }

      .graphic-tile.current {
        outline: 2px solid var(--green-text, #6f6);
      }

      .graphic-tile img {
        width: 128px;
        height: 128px;
        object-fit: contain;
        image-rendering: pixelated;
        background: repeating-conic-gradient(#333 0% 25%, #444 0% 50%) 0 0 / 16px 16px;
      }

      .graphic-tile .placeholder {
        width: 128px;
        height: 128px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #2a2a2a;
        color: #666;
      }

      .graphic-tile .meta {
        font-size: 12px;
        color: #888;
        margin-top: 5px;
        word-break: break-all;
      }

      .graphic-tile .name {
        font-family: monospace;
        color: var(--blue-text);
      }

      .hint {
        color: #888;
        font-size: 12px;
      }

      .gone {
        padding: 40px;
        text-align: center;
        color: #888;
      }

      sl-details.raw-data {
        margin-top: 10px;
      }

      pre.raw {
        background-color: var(--darker-panel-color);
        padding: 10px;
        overflow-x: auto;
        font-size: 12px;
        margin: 0;
        user-select: text;
      }
    `
  ];

  @property({ type: Boolean })
  open = false;

  @property({ type: Object })
  entity: InspectedEntity | null = null;

  @property({ type: Object })
  graphics: EntityGraphicsDetail | null = null;

  @state()
  private _editorFocused = false;

  private _freezeUntil = 0;

  private _freezeTimer = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('focusin', this._handleFocusIn);
    this.addEventListener('focusout', this._handleFocusOut);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('focusin', this._handleFocusIn);
    this.removeEventListener('focusout', this._handleFocusOut);
    if (this._freezeTimer) {
      clearTimeout(this._freezeTimer);
      this._freezeTimer = 0;
    }
    super.disconnectedCallback();
  }

  private _isEditorTarget(evt: Event): boolean {
    return evt.composedPath().some((el) => el instanceof HTMLElement && el.classList?.contains('prop-editor'));
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
    if (!this.isConnected || this._editorFocused) {
      return false;
    }
    const now = Date.now();
    if (now < this._freezeUntil) {
      // re-render once the freeze passes so the blocked update isn't lost
      if (!this._freezeTimer) {
        this._freezeTimer = window.setTimeout(() => {
          this._freezeTimer = 0;
          this.requestUpdate();
        }, this._freezeUntil - now);
      }
      return false;
    }
    return true;
  }

  private _dispatchPropertyChange(
    target: EntityPropertyUpdate['target'],
    property: string,
    kind: EntityPropertyUpdate['kind'],
    value: EntityPropertyUpdate['value']
  ) {
    if (!this.entity) {
      return;
    }
    this._freezeUntil = Date.now() + 400;
    this.dispatchEvent(
      new CustomEvent<EntityPropertyUpdate>('entity-property-change', {
        detail: { entityId: this.entity.id, target, property, kind, value },
        bubbles: true,
        composed: true
      })
    );
  }

  private _numberChangeHandler(target: EntityPropertyUpdate['target'], property: string, toWire: (n: number) => number = (n) => n) {
    return (evt: Event) => {
      const raw = (evt.target as SlInput).value;
      // Number('') is 0, so an emptied field would silently write 0 into the
      // running game; skip instead — the next unfrozen heartbeat re-render
      // restores the live value
      if (raw.trim() === '') {
        return;
      }
      const num = Number(raw);
      if (Number.isFinite(num)) {
        this._dispatchPropertyChange(target, property, 'number', toWire(num));
      }
    };
  }

  private _boolChangeHandler(target: EntityPropertyUpdate['target'], property: string) {
    return (evt: Event) => {
      this._dispatchPropertyChange(target, property, 'boolean', (evt.target as SlSwitch).checked);
    };
  }

  private _vecChangeHandler(target: EntityPropertyUpdate['target'], property: string) {
    return () => {
      const inputs = Array.from(
        this.shadowRoot!.querySelectorAll<SlInput>(`sl-input[data-vec="${CSS.escape(`${target}.${property}`)}"]`)
      ).sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));
      const values = inputs.map((input) => (input.value.trim() === '' ? NaN : Number(input.value)));
      // An emptied or non-numeric axis must not be coerced to 0 in the game
      if (values.length < 2 || values.some((v) => !Number.isFinite(v))) {
        return;
      }
      this._dispatchPropertyChange(target, property, 'vector', { x: values[0], y: values[1] });
    };
  }

  private _navigateHandler(entityId: number) {
    return () => {
      this.dispatchEvent(new CustomEvent<number>('inspect-entity', { detail: entityId, bubbles: true, composed: true }));
    };
  }

  private _useGraphicHandler(graphicName: string, source: 'local' | 'registry') {
    return () => {
      if (!this.entity) {
        return;
      }
      this._freezeUntil = Date.now() + 400;
      this.dispatchEvent(
        new CustomEvent<{ entityId: number; graphicName: string; source: 'local' | 'registry' }>('use-graphic', {
          detail: { entityId: this.entity.id, graphicName, source },
          bubbles: true,
          composed: true
        })
      );
    };
  }

  private _closeHandler = (evt: Event) => {
    // sl-hide bubbles from nested shoelace components too; only react to the dialog itself
    if ((evt.target as HTMLElement).tagName === 'SL-DIALOG') {
      this.dispatchEvent(new CustomEvent('inspector-closed', { bubbles: true, composed: true }));
    }
  };

  private _nameChangeHandler = (evt: Event) => {
    this._dispatchPropertyChange('entity', 'name', 'string', (evt.target as SlInput).value);
  };

  private _renderNumberEditor(target: EntityPropertyUpdate['target'], property: string, value: number, toWire?: (n: number) => number) {
    return html`
      <sl-input
        class="prop-editor"
        type="number"
        size="small"
        step="any"
        .value=${formatNumber(value)}
        @sl-change=${this._numberChangeHandler(target, property, toWire)}
      ></sl-input>
    `;
  }

  private _renderVecEditor(target: EntityPropertyUpdate['target'], property: string, vec: { x: number; y: number }) {
    return html`
      <div class="vec-editor">
        ${[vec.x, vec.y].map(
          (component, i) => html`
            <span class="axis">${i === 0 ? 'x' : 'y'}</span>
            <sl-input
              class="prop-editor"
              type="number"
              size="small"
              step="any"
              data-vec="${target}.${property}"
              data-index=${i}
              .value=${formatNumber(component)}
              @sl-change=${this._vecChangeHandler(target, property)}
            ></sl-input>
          `
        )}
      </div>
    `;
  }

  private _renderBoolEditor(target: EntityPropertyUpdate['target'], property: string, value: boolean) {
    return html`
      <sl-switch class="prop-editor" .checked=${value} @sl-change=${this._boolChangeHandler(target, property)}></sl-switch>
    `;
  }

  private _renderRow(name: string, contents: unknown) {
    return html`
      <tr>
        <td class="prop-name">${name}</td>
        <td>${contents}</td>
      </tr>
    `;
  }

  private _renderReadOnlyRows(data: Record<string, unknown>, skip: string[]) {
    const keys = Object.keys(data).filter((key) => key !== 'type' && !skip.includes(key));
    return repeat(
      keys,
      (key) => key,
      (key) => this._renderRow(key, html`<span class="prop-value">${formatLoose(data[key])}</span>`)
    );
  }

  private _renderTransform(component: InspectedComponent) {
    const data = component.data;
    const rotationDeg = (asNumber(data.rotation) * 180) / Math.PI;
    return html`
      <table>
        <tbody>
          ${this._renderRow('pos', this._renderVecEditor('transform', 'pos', asVector(data.pos)))}
          ${this._renderRow(
            'rotation (deg)',
            this._renderNumberEditor('transform', 'rotation', rotationDeg, (deg) => (deg * Math.PI) / 180)
          )}
          ${this._renderRow('scale', this._renderVecEditor('transform', 'scale', asVector(data.scale)))}
          ${this._renderRow('z', this._renderNumberEditor('transform', 'z', asNumber(data.z)))}
          ${this._renderReadOnlyRows(data, ['pos', 'rotation', 'scale', 'z'])}
        </tbody>
      </table>
    `;
  }

  private _renderMotion(component: InspectedComponent) {
    const data = component.data;
    return html`
      <table>
        <tbody>
          ${this._renderRow('vel', this._renderVecEditor('motion', 'vel', asVector(data.vel)))}
          ${this._renderRow('acc', this._renderVecEditor('motion', 'acc', asVector(data.acc)))}
          ${this._renderRow('angularVelocity', this._renderNumberEditor('motion', 'angularVelocity', asNumber(data.angularVelocity)))}
          ${this._renderRow('torque', this._renderNumberEditor('motion', 'torque', asNumber(data.torque)))}
          ${this._renderReadOnlyRows(data, ['vel', 'acc', 'angularVelocity', 'torque'])}
        </tbody>
      </table>
    `;
  }

  private _opacityChangeHandler = (evt: Event) => {
    this._dispatchPropertyChange('graphics', 'opacity', 'number', Number((evt.target as SlRange).value) || 0);
  };

  private _renderGraphics(component: InspectedComponent) {
    const data = component.data;
    return html`
      <table>
        <tbody>
          ${this._renderRow(
            'opacity',
            html`
              <sl-range
                class="prop-editor"
                min="0"
                max="1"
                step="0.01"
                .value=${asNumber(data.opacity, 1)}
                @sl-change=${this._opacityChangeHandler}
              ></sl-range>
            `
          )}
          ${this._renderRow('isVisible', this._renderBoolEditor('graphics', 'isVisible', data.isVisible !== false))}
          ${this._renderRow('flipHorizontal', this._renderBoolEditor('graphics', 'flipHorizontal', data.flipHorizontal === true))}
          ${this._renderRow('flipVertical', this._renderBoolEditor('graphics', 'flipVertical', data.flipVertical === true))}
          ${this._renderRow('offset', this._renderVecEditor('graphics', 'offset', asVector(data.offset)))}
          ${this._renderRow('anchor', this._renderVecEditor('graphics', 'anchor', asVector(data.anchor)))}
          ${this._renderReadOnlyRows(data, [
            'opacity',
            'isVisible',
            'flipHorizontal',
            'flipVertical',
            'offset',
            'anchor',
            'current',
            'graphicRefs',
            'options'
          ])}
        </tbody>
      </table>
      ${this._renderGraphicsSwitcher()}
    `;
  }

  private _collisionTypeChangeHandler = (evt: Event) => {
    this._dispatchPropertyChange('body', 'collisionType', 'string', String((evt.target as SlSelect).value));
  };

  private _renderBody(component: InspectedComponent) {
    const data = component.data;
    const collisionType = typeof data.collisionType === 'string' ? data.collisionType : '';
    return html`
      <table>
        <tbody>
          ${this._renderRow(
            'collisionType',
            html`
              <sl-select class="prop-editor" size="small" .value=${collisionType} @sl-change=${this._collisionTypeChangeHandler}>
                ${COLLISION_TYPES.map((type) => html`<sl-option value=${type}>${type}</sl-option>`)}
              </sl-select>
            `
          )}
          ${this._renderRow('mass', this._renderNumberEditor('body', 'mass', asNumber(data.mass)))}
          ${this._renderRow('friction', this._renderNumberEditor('body', 'friction', asNumber(data.friction)))}
          ${this._renderRow('bounciness', this._renderNumberEditor('body', 'bounciness', asNumber(data.bounciness)))}
          ${this._renderRow('useGravity', this._renderBoolEditor('body', 'useGravity', data.useGravity === true))}
          ${this._renderReadOnlyRows(data, ['collisionType', 'mass', 'friction', 'bounciness', 'useGravity'])}
        </tbody>
      </table>
    `;
  }

  private _renderGenericData(component: InspectedComponent) {
    const data = component.data;
    const keys = Object.keys(data).filter((key) => key !== 'type');
    if (keys.length === 0) {
      return html`<div class="hint">No serialized data</div>`;
    }
    return html`
      <table>
        <tbody>
          ${this._renderReadOnlyRows(data, [])}
        </tbody>
      </table>
    `;
  }

  private _renderGraphicTile(thumb: EntityGraphicsDetail['local'][number], source: 'local' | 'registry', current: string) {
    const isCurrent = source === 'local' && thumb.name === current;
    return html`
      <div
        class="graphic-tile ${isCurrent ? 'current' : ''}"
        title=${isCurrent ? 'Current graphic' : 'Click to show this graphic'}
        @click=${this._useGraphicHandler(thumb.name, source)}
      >
        ${thumb.dataUrl
          ? html`<img src=${thumb.dataUrl} alt=${thumb.name} />`
          : html`<div class="placeholder">${thumb.type}</div>`}
        <div class="meta">
          <div class="name">${thumb.name}</div>
          <div>${thumb.type}${thumb.width && thumb.height ? html` — ${thumb.width}×${thumb.height}` : nothing}</div>
        </div>
      </div>
    `;
  }

  private _renderGraphicsSwitcher() {
    const entity = this.entity;
    if (!entity) {
      return nothing;
    }
    const graphics = this.graphics;
    // the live current name from the heartbeat wins over the cached fetch
    const current = entity.graphicsCurrent;
    return html`
      <h3>Graphics</h3>
      ${graphics === null
        ? html`<div class="hint">Loading graphics…</div>`
        : html`
            ${graphics.local.length > 0
              ? html`<div class="graphics-grid">
                  ${repeat(
                    graphics.local,
                    (thumb) => thumb.name,
                    (thumb) => this._renderGraphicTile(thumb, 'local', current)
                  )}
                </div>`
              : html`<div class="hint">No graphics on this entity</div>`}
            <h3>Serializer Registry</h3>
            ${!graphics.registryAvailable
              ? html`<div class="hint">
                  Registry unavailable — expose the engine namespace as <code>window.ex</code> and register graphics with
                  <code>ex.Serializer.registerGraphic(name, graphic)</code> to switch to graphics from anywhere.
                </div>`
              : graphics.registry.length === 0
                ? html`<div class="hint">No graphics registered with <code>ex.Serializer.registerGraphic</code></div>`
                : html`<div class="graphics-grid">
                    ${repeat(
                      graphics.registry,
                      (thumb) => thumb.name,
                      (thumb) => this._renderGraphicTile(thumb, 'registry', current)
                    )}
                  </div>`}
          `}
    `;
  }

  private _renderComponent(component: InspectedComponent) {
    let body;
    switch (component.kind) {
      case 'transform':
        body = this._renderTransform(component);
        break;
      case 'motion':
        body = this._renderMotion(component);
        break;
      case 'graphics':
        body = this._renderGraphics(component);
        break;
      case 'body':
        body = this._renderBody(component);
        break;
      default:
        body = this._renderGenericData(component);
        break;
    }
    return html`
      <h3>${component.type}</h3>
      <div class="section">
        ${component.error ? html`<div class="component-error">Failed to serialize this component</div>` : body}
      </div>
    `;
  }

  private _renderEntity(entity: InspectedEntity) {
    return html`
      <div class="header-row">
        <sl-input
          class="prop-editor"
          size="small"
          label="Name"
          .value=${entity.name}
          @sl-change=${this._nameChangeHandler}
        ></sl-input>
        <sl-tag variant="primary">id:${entity.id}</sl-tag>
        <sl-tag variant="neutral">${entity.ctor}</sl-tag>
        ${repeat(
          entity.tags,
          (tag) => tag,
          (tag) => html`<sl-tag variant="success">${tag}</sl-tag>`
        )}
        ${entity.isKilled ? html`<sl-tag variant="danger">killed</sl-tag>` : nothing}
        ${entity.serializerSource === 'reflection'
          ? html`<sl-tag variant="warning" title="This engine version predates the serialization API; showing a best-effort reflection of well-known components">
              reflection fallback
            </sl-tag>`
          : nothing}
      </div>
      ${entity.parent || entity.children.length > 0
        ? html`
            <div class="hierarchy">
              ${entity.parent
                ? html`
                    <span class="label">Parent</span>
                    <sl-tag variant="neutral" @click=${this._navigateHandler(entity.parent.id)}>
                      ${entity.parent.name} (#${entity.parent.id})
                    </sl-tag>
                  `
                : nothing}
              ${entity.children.length > 0
                ? html`
                    <span class="label">Children</span>
                    ${repeat(
                      entity.children,
                      (child) => child.id,
                      (child) => html`
                        <sl-tag variant="neutral" @click=${this._navigateHandler(child.id)}>
                          ${child.name} (#${child.id})
                        </sl-tag>
                      `
                    )}
                  `
                : nothing}
            </div>
          `
        : nothing}
      ${repeat(
        entity.components,
        // Minified games collapse constructor names ('t', 'e', ...), so the
        // type alone can collide; the index keeps keys unique
        (component, index) => `${component.type}#${index}`,
        (component) => this._renderComponent(component)
      )}
    `;
  }

  override render() {
    const entity = this.entity;
    return html`
      <sl-dialog class="entity-inspect" label=${entity ? `${entity.name} | ${entity.ctor}` : 'Entity Inspector'} ?open=${this.open} @sl-hide=${this._closeHandler}>
        <div class="dialog-body">
          ${this.open
            ? entity
              ? this._renderEntity(entity)
              : html`<div class="gone">Entity not available — it may have been removed from the scene</div>`
            : nothing}
        </div>
      </sl-dialog>
    `;
  }
}
