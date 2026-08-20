import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat';
import { colors } from '../colors';
import { common } from '../common';
import { SlChangeEvent, SlInput, SlInputEvent, SlSwitch } from '@shoelace-style/shoelace';

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
      #pick-entity {
        margin-bottom: 10px;
      }
      sl-switch {
        padding-bottom: 10px;
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

    return html`
      <div class="section">
        <sl-button id="pick-entity" size="small" variant=${this.pickerArmed ? 'primary' : 'default'} @click=${this._togglePicker}>
          <sl-icon slot="prefix" name="crosshair"></sl-icon>
          ${this.pickerArmed ? 'Picking… (Esc to cancel)' : 'Pick entity on page'}
        </sl-button>
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
