import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { colors } from '../colors';
import { common } from '../common';
import { SlChangeEvent, SlCheckbox, SlInput, SlInputEvent, SlSwitch } from '@shoelace-style/shoelace';

/**
 * Case-insensitive sort with lowercase sorting before uppercase on an
 * otherwise-equal string (default JS sort puts 'A' before 'a', the opposite)
 */
function sortIgnoreCase(values: string[]): string[] {
  return [...values].sort((a, b) => {
    const al = a.toLowerCase();
    const bl = b.toLowerCase();
    if (al !== bl) {
      return al < bl ? -1 : 1;
    }
    return a < b ? 1 : a > b ? -1 : 0;
  });
}

export interface Entity {
  id: number;
  name: string;
  ctor: string;
  pos: string;
  z: string;

  coordPlane: string;
  collisionType: string;
  collisionGroup: number;
  collisionMask: number;

  tags: string[];
}

/**
 * @event kill-actor
 * @event identify-actor
 * @event inspect-entity
 * @event toggle-picker
 * @event toggle-ignored-ctor
 * @event toggle-ignored-name
 * @event clear-ignored
 */
@customElement('entity-list')
export class EntityList extends LitElement {
  static styles = [
    colors,
    common,
    css`
      :host {
        display: block;
        max-width: 300px;
      }

      ul {
        position: relative;
        list-style: none;
        padding: 0;
        max-height: 30em;
        overflow-y: auto;
      }
      sl-card {
        width: 270px;
        padding-bottom: 10px;
      }

      sl-card [slot='header'] {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      sl-card [slot='header'] .entity-name {
        word-break: break-word;
      }

      sl-card [slot='header'] .actions {
        display: flex;
      }

      sl-tag {
        margin: 2px;
      }

      sl-input {
        padding-bottom: 10px;
      }
      sl-switch {
        padding-bottom: 10px;
      }

      .picker-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      .ignore-trigger {
        font-size: inherit;
        color: var(--blue-text);
        cursor: pointer;
        user-select: none;
      }

      .ignore-trigger:hover {
        text-decoration: underline;
      }

      .ignore-trigger.active {
        color: var(--green-text);
      }

      .ignore-badge {
        margin-left: 4px;
        vertical-align: middle;
      }

      .ignore-panel {
        padding: 10px;
        background-color: var(--darker-panel-color);
        width: 220px;
      }

      .ignore-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .ignore-panel-header .title {
        color: #888;
        font-size: 11px;
        text-transform: uppercase;
      }

      .ignore-panel-header .clear-btn {
        font-size: 11px;
        color: var(--blue-text);
        cursor: pointer;
        user-select: none;
      }

      .ignore-panel-header .clear-btn:hover {
        text-decoration: underline;
      }

      .ignore-group {
        margin-bottom: 8px;
      }

      .ignore-group:last-child {
        margin-bottom: 0;
      }

      .ignore-group .group-label {
        color: #888;
        font-size: 11px;
        text-transform: uppercase;
        margin-bottom: 4px;
      }

      .ignore-list {
        max-height: 140px;
        overflow-y: auto;
      }

      .ignore-list sl-checkbox {
        display: block;
        margin: 2px 0;
        font-size: 13px;
      }

      .scrollbar::-webkit-scrollbar-track {
        -webkit-box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3);
        border-radius: 5px;
        background-color: var(--background-color);
      }

      .scrollbar::-webkit-scrollbar {
        width: 6px;
        background-color: var(--blue-background);
      }

      .scrollbar::-webkit-scrollbar-thumb {
        border-radius: 5px;
        background-color: var(--green-text);
      }
    `
  ];

  override shouldUpdate() {
    return this.isConnected;
  }

  @property({ type: Array })
  entities: Entity[] = [];

  @property({ type: Boolean })
  pickerArmed = false;

  @property({ type: Array })
  ignoredCtors: string[] = [];

  @property({ type: Array })
  ignoredNames: string[] = [];

  @state()
  showOffscreen = false;

  @state()
  entityFilter = '';

  private _toggleOffscreen(evt: SlChangeEvent) {
    this.showOffscreen = !!(evt?.target as SlSwitch).checked;
  }

  private _inputFilter(evt: SlInputEvent) {
    this.entityFilter = (evt.target as SlInput).value;
  }

  handleKill(id: number) {
    return () => {
      this.dispatchEvent(new CustomEvent('kill-actor', { detail: id }));
    };
  }

  private _identifyEntity(id: number) {
    return () => {
      this.dispatchEvent(
        new CustomEvent('identify-actor', {
          detail: id
        })
      );
    };
  }

  private _inspectEntity(id: number) {
    return () => {
      this.dispatchEvent(
        new CustomEvent('inspect-entity', {
          detail: id
        })
      );
    };
  }

  private _togglePicker() {
    this.dispatchEvent(new CustomEvent('toggle-picker', { bubbles: true, composed: true }));
  }

  private _toggleIgnoredCtor(ctor: string) {
    return (evt: SlChangeEvent) => {
      this.dispatchEvent(
        new CustomEvent<{ ctor: string; ignored: boolean }>('toggle-ignored-ctor', {
          detail: { ctor, ignored: (evt.target as SlCheckbox).checked },
          bubbles: true,
          composed: true
        })
      );
    };
  }

  private _toggleIgnoredName(name: string) {
    return (evt: SlChangeEvent) => {
      this.dispatchEvent(
        new CustomEvent<{ name: string; ignored: boolean }>('toggle-ignored-name', {
          detail: { name, ignored: (evt.target as SlCheckbox).checked },
          bubbles: true,
          composed: true
        })
      );
    };
  }

  private _clearIgnored = () => {
    this.dispatchEvent(new CustomEvent('clear-ignored', { bubbles: true, composed: true }));
  };

  render() {
    let entities = this.entities.slice();
    if (!this.showOffscreen) {
      entities = entities.filter((e) => !e.tags.includes('ex.offscreen'));
    }

    if (this.entityFilter) {
      entities = entities.filter(
        (e) => e.name.includes(this.entityFilter) || e.ctor.includes(this.entityFilter) || e.tags.some((t) => t.includes(this.entityFilter))
      );
    }

    // Unfiltered, so a type/name stays toggleable even while the filter above hides its instances
    const allCtors = sortIgnoreCase(Array.from(new Set(this.entities.map((e) => e.ctor))));
    const allNames = sortIgnoreCase(Array.from(new Set(this.entities.map((e) => e.name))).filter(Boolean));
    const ignoredCount = this.ignoredCtors.length + this.ignoredNames.length;

    return html`
      <div class="section">
        <div class="picker-row">
          <sl-button id="pick-entity" size="small" variant=${this.pickerArmed ? 'primary' : 'default'} @click=${this._togglePicker}>
            <sl-icon slot="prefix" name="crosshair"></sl-icon>
            ${this.pickerArmed ? 'Picking… (Esc to cancel)' : 'Pick entity on page'}
          </sl-button>
          ${allCtors.length > 0 || allNames.length > 0
            ? html`
                <sl-dropdown class="ignore-dropdown" hoist>
                  <span slot="trigger" class="ignore-trigger ${ignoredCount > 0 ? 'active' : ''}" tabindex="0">
                    Ignore…${ignoredCount > 0
                      ? html`<sl-badge class="ignore-badge" variant="success" pill>${ignoredCount}</sl-badge>`
                      : nothing}
                  </span>
                  <div class="ignore-panel">
                    <div class="ignore-panel-header">
                      <span class="title">Ignore for picking</span>
                      ${ignoredCount > 0 ? html`<span class="clear-btn" @click=${this._clearIgnored}>Clear</span>` : nothing}
                    </div>
                    ${allCtors.length > 0
                      ? html`
                          <div class="ignore-group">
                            <div class="group-label">By Type</div>
                            <div class="ignore-list scrollbar">
                              ${repeat(
                                allCtors,
                                (ctor) => ctor,
                                (ctor) => html`
                                  <sl-checkbox .checked=${this.ignoredCtors.includes(ctor)} @sl-change=${this._toggleIgnoredCtor(ctor)}
                                    >${ctor}</sl-checkbox
                                  >
                                `
                              )}
                            </div>
                          </div>
                        `
                      : nothing}
                    ${allNames.length > 0
                      ? html`
                          <div class="ignore-group">
                            <div class="group-label">By Name</div>
                            <div class="ignore-list scrollbar">
                              ${repeat(
                                allNames,
                                (name) => name,
                                (name) => html`
                                  <sl-checkbox .checked=${this.ignoredNames.includes(name)} @sl-change=${this._toggleIgnoredName(name)}
                                    >${name}</sl-checkbox
                                  >
                                `
                              )}
                            </div>
                          </div>
                        `
                      : nothing}
                  </div>
                </sl-dropdown>
              `
            : nothing}
        </div>
        <sl-input id="filter-entities" @sl-input=${this._inputFilter} placeholder="Filter Entities by Name, Ctor, or Tag"></sl-input>
        <sl-switch id="show-offscreen" @sl-change=${this._toggleOffscreen}>Show Offscreen Entities</sl-switch>
        <ul class="scrollbar">
          ${repeat(
            entities,
            (entity: Entity) => entity.id,
            (entity: Entity) => html`
              <li>
                <sl-card>
                  <div slot="header">
                    <span class="entity-name">${entity.name} | ${entity.ctor}</span>
                    <div class="actions">
                      <sl-icon-button
                        name="zoom-in"
                        label="Inspect entity ${entity.id}"
                        @click="${this._inspectEntity(entity.id)}"
                      ></sl-icon-button>
                      <sl-icon-button
                        name="search"
                        label="Identify entity ${entity.id}"
                        @click="${this._identifyEntity(entity.id)}"
                      ></sl-icon-button>
                      <sl-icon-button name="trash" label="kill" @click=${this.handleKill(entity.id)}></sl-icon-button>
                    </div>
                  </div>
                  <sl-tag variant="primary">id:${entity.id}</sl-tag>
                  <sl-tag variant="neutral">pos:${entity.pos}</sl-tag>
                  <sl-tag variant="neutral">z:${entity.z}</sl-tag>
                  ${repeat(
                    entity.tags,
                    (tag) => tag,
                    (tag) => html` <sl-tag variant="success">${tag}</sl-tag> `
                  )}
                  ${entity.coordPlane ? html`<sl-tag variant="warning">coordPlane:${entity.coordPlane}</sl-tag>` : nothing}
                  ${entity.collisionType ? html`<sl-tag variant="danger">collision type:${entity.collisionType}</sl-tag>` : nothing}
                  ${entity.collisionGroup && entity.collisionGroup !== -1
                    ? html`<sl-tag variant="neutral">collision group:0x${(entity.collisionGroup >>> 0).toString(16)}</sl-tag>`
                    : nothing}
                  ${entity.collisionMask && entity.collisionMask !== -1
                    ? html`<sl-tag variant="neutral">collision mask:0x${(entity.collisionMask >>> 0).toString(16)}</sl-tag>`
                    : nothing}
                </sl-card>
              </li>
            `
          )}
        </ul>
      </div>
    `;
  }
}
