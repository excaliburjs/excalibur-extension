import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { colors } from '../colors';
import { common } from '../common';

/**
 * Fullscreen overlay shown over the panel when no Excalibur instance is
 * detected on the inspected page.
 */
@customElement('no-excalibur-overlay')
export class NoExcaliburOverlay extends LitElement {
  static styles = [
    colors,
    common,
    css`
      :host {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--background-color);
        color: #ccc;
        font-family: sans-serif;
      }

      .message {
        position: relative;
        background-color: var(--panel-color);
        padding: 20px 30px;
        font-size: 18px;
      }

      .message::before {
        content: '';
        position: absolute;
        left: -5px;
        top: 0;
        height: 100%;
        border-left: 5px solid var(--ex-blue-accent);
      }
    `
  ];

  @property()
  message = 'No Excalibur detected on the page';

  override shouldUpdate() {
    return this.isConnected;
  }

  override render() {
    return html`<div class="message">${this.message}</div>`;
  }
}
