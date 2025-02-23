import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat';

@customElement('scene-list')
export class SceneList extends LitElement {
  static styles = [
    css`
      :host {
        display: block;
      }
      li {
        margin: 10px;
      }
    `
  ];

  @property({ type: Array }) scenes: string[] = [];

  handleGoto(scene: string) {
    return () => {
      this.dispatchEvent(new CustomEvent('goto-scene', { detail: scene }));
    };
  }

  render() {
    return html`<div>
      ${repeat(
        this.scenes,
        (scene: string) => scene,
        (scene: string) => html`
          <li>
            ${scene}
            <!-- <sl-button @click=${this.handleGoto(scene)}>Go to ${scene}</sl-button> -->
          </li>
        `
      )}
    </div>`;
  }
}
