import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { colors } from '../colors';
import { common } from '../common';
import { repeat } from 'lit/directives/repeat';

@customElement('system-stats-list')
export class SystemStatsList extends LitElement {
  static styles = [
    colors,
    common,
    css`
      :host {
        display: block;
        max-width: 900px;
      }
      .section {
        flex-grow: 1;
        position: relative;
        padding: 10px;
        background-color: var(--panel-color);
        margin-bottom: 10px;
      }

      .section .form-row:nth-child(odd) {
        backdrop-filter: brightness(20%);
      }

      .form-row span {
        margin-left: auto;
      }
    `
  ];

  @property({ type: Object })
  systemDuration: Record<string, number>= {};

  updateStats(stats: Record<string, number>) {
    this.systemDuration= stats;
    this.requestUpdate();
  }

  override render() {
    const systemDuration = this.systemDuration;
    const durations = Object.entries(systemDuration ?? {}).sort((a,b) => b[1] - a[1]);

    return html`
      <div class="section">
        ${repeat(
            durations,
            item => item[1],
            (item) => {
              return html`<div class="form-row">${item[0]}<span>${item[1].toFixed(2)}</span></div>`
            })
        }
      </div>
    `;
  }
}
