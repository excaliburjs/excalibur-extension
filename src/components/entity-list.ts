import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat';
import { colors } from '../colors';
import { common } from '../common';
import { SlChangeEvent, SlInput, SlInputEvent, SlSwitch } from '@shoelace-style/shoelace';

// import '@shoelace-style/shoelace/dist/components/card';
// import '@shoelace-style/shoelace/dist/components/tag';

export interface Entity {
  id: number;
  name: string;
  ctor: string;
  pos: string;
  tags: string[];
}

/**
 * @event kill-actor
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

  @property({ type: Array })
  entities: Entity[] = [];

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
          detail: id,
        }),
      );
    };
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
                      <sl-icon-button name="search" label="Identify entity ${entity.id}" @click="${this._identifyEntity(entity.id)}"></sl-icon-button>
                      <sl-icon-button name="trash" label="kill" @click=${this.handleKill(entity.id)}></sl-icon-button>
                    </div>
                  </div>
                  <sl-tag variant="primary">id:${entity.id}</sl-tag>
                  <sl-tag variant="neutral">pos:${entity.pos}</sl-tag>
                  ${repeat(
                    entity.tags,
                    (tag) => tag,
                    (tag) => html` <sl-tag variant="success">${tag}</sl-tag> `
                  )}
                </sl-card>
              </li>
            `
          )}
        </ul>
      </div>
    `;
  }
}
