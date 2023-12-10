import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat';
import { colors } from '../colors';
import { common } from '../common';

// import '@shoelace-style/shoelace/dist/components/card';
// import '@shoelace-style/shoelace/dist/components/tag';

export interface Entity {
    id: number,
    name: string,
    ctor: string,
    pos: string,
    tags: string[]
}

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

            sl-tag {
                margin: 2px;
            }

            .scrollbar::-webkit-scrollbar-track
            {
                -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
                border-radius: 5px;
                background-color: var(--background-color);
            }

            .scrollbar::-webkit-scrollbar
            {
                width: 6px;
                background-color: var(--blue-background);
            }

            .scrollbar::-webkit-scrollbar-thumb
            {
                border-radius: 5px;
                background-color: var(--green-text);
            }
        `
    ];

    @property({ type: Array }) entities: Entity[] = [];

    render() {
        return html`
        <div class="section">
            <ul class="scrollbar">
            ${repeat(this.entities, (entity: Entity) => entity.id, (entity: Entity) => html`
                <li>
                    <sl-card>
                        <div slot="header"> ${entity.name} | ${entity.ctor} 
                            <sl-icon-button name="trash" label="kill"></sl-icon-button> 
                        </div>
                            <sl-tag variant="primary">id:${entity.id}</sl-tag>
                            <sl-tag variant="neutral">pos:${entity.pos}</sl-tag>
                        ${repeat(entity.tags, tag => tag, tag => html`
                            <sl-tag variant="success">${tag}</sl-tag>
                        `)}
                    </sl-card>
                </li>
            `)}
            </ul>
        </div>
        `;
    }
}
