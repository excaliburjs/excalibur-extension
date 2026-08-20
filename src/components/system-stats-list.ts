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

  override shouldUpdate() {
    return this.isConnected;
  }

  /** Number of samples in the rolling window: 5s at the 200ms heartbeat. */
  private static readonly _WINDOW_SIZE = 25;

  private _samples: Record<string, number[]> = {};

  @property({ type: Object })
  systemDuration: Record<string, number> = {};

  updateStats(stats: Record<string, number>) {
    if (!this.isConnected) {
      return;
    }
    for (const key in stats) {
      if (!this._samples[key]) {
        this._samples[key] = [];
      }
      this._samples[key].push(stats[key]);
      if (this._samples[key].length > SystemStatsList._WINDOW_SIZE) {
        this._samples[key].shift();
      }
    }
    for (const key of Object.keys(this._samples)) {
      if (!(key in stats)) {
        delete this._samples[key];
      }
    }
    this.systemDuration = stats;
    this.requestUpdate();
  }

  /** Clears all samples and durations (instance/frame change). */
  reset() {
    this._samples = {};
    this.systemDuration = {};
    this.requestUpdate();
  }

  override render() {
    const averages = Object.entries(this._samples).map(
      ([key, samples]) => [key, samples.reduce((a, b) => a + b, 0) / samples.length] as [string, number]
    );
    averages.sort((a, b) => b[1] - a[1]);

    return html`
      <div class="section">
        ${repeat(
          averages,
          (item) => item[0],
          (item) => {
            return html`<div class="form-row">${item[0]}<span>${item[1].toFixed(2)}</span></div>`;
          }
        )}
      </div>
    `;
  }
}
