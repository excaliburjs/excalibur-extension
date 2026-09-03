import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { colors } from '../colors';
import { common } from '../common';
import type { FatalErrorInfo } from '../protocol';

/**
 * Modal dialog shown when a game in the inspected tab has recorded a fatal
 * error: the error message, the stack trace, and which instance crashed.
 * Data flows in from app-main (heartbeat instances); dismissal flows up as
 * the `fatal-error-closed` event.
 * @event fatal-error-closed - Emitted when the dialog is dismissed
 */
@customElement('fatal-error-dialog')
export class FatalErrorDialog extends LitElement {
  static styles = [
    colors,
    common,
    css`
      sl-dialog.fatal-error {
        --width: calc(100vw - 32px);
      }

      .message {
        font-family: monospace;
        font-size: 14px;
        color: var(--red-accent);
        margin-bottom: 8px;
        overflow-wrap: anywhere;
      }

      .context {
        color: #888;
        font-size: 12px;
        margin-bottom: 10px;
      }

      .stack {
        max-height: calc(100vh - 240px);
        overflow: auto;
        margin: 0;
        padding: 8px;
        background-color: var(--darker-panel-color);
        border: 1px solid #333;
        font-family: monospace;
        font-size: 12px;
        line-height: 1.4;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      .no-stack {
        color: #888;
        font-size: 12px;
      }
    `
  ];

  /** Whether the dialog is open (app-main auto-opens on a new fatal error). */
  @property({ attribute: false })
  open = false;

  /** The fatal error to display, or null while nothing crashed. */
  @property({ attribute: false })
  fatalError: FatalErrorInfo | null = null;

  /** Engine version of the crashed instance (context line). */
  @property({ attribute: false })
  engineVersion = '???';

  /** Frame id of the crashed instance (context line). */
  @property({ attribute: false })
  frameId: number | null = null;

  override shouldUpdate() {
    return this.isConnected;
  }

  private _closeHandler = () => {
    this.dispatchEvent(new CustomEvent('fatal-error-closed', { bubbles: true, composed: true }));
  };

  override render() {
    const error = this.fatalError;
    return html`
      <sl-dialog class="fatal-error" label="Fatal Game Error" ?open=${this.open && !!error} @sl-hide=${this._closeHandler}>
        ${error
          ? html`
              <div class="message">${error.message}</div>
              <div class="context">Engine v${this.engineVersion} · frame ${this.frameId ?? 0} · the game loop has stopped</div>
              ${error.stack
                ? html`<pre class="stack">${error.stack}</pre>`
                : html`<div class="no-stack">No stack trace was recorded — a non-Error value was thrown.</div>`}
            `
          : nothing}
      </sl-dialog>
    `;
  }
}
