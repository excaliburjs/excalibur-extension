import { LitElement, css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { PopupStateReply } from './protocol';
import { comboFromEvent, isReservedCombo, prettifyCombo } from './popup-shortcut';

if (typeof browser == 'undefined') {
  // Chrome does not support the browser namespace yet.
  globalThis.browser = globalThis.chrome;
}

type PopupStatus = 'loading' | 'ready' | 'no-game' | 'error';

const COMMAND_NAME = 'toggle-debug';
const IS_MAC = /Mac/i.test(navigator.userAgent);

/**
 * The toolbar action popup: a one-button quick toggle for the game's master
 * debug flag, plus the shortcut binding for the browser-level `toggle-debug`
 * command. Deliberately minimal — no Shoelace, no port. Everything page
 * related is round-tripped through the background's runtime.onMessage
 * handlers (`ex-debug:popup-get-state` / `ex-debug:popup-toggle-debug`), so
 * the popup works with or without a devtools panel open and can never be
 * clobbered by one (the background makes live connections adopt the value).
 */
@customElement('ex-popup')
export class ExPopup extends LitElement {
  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      width: 260px;
      padding: 10px 12px 12px;
      background-color: var(--background-color);
      color: #ccc;
      font-family: sans-serif;
      font-size: 14px;
    }

    .status {
      margin-top: 0;
      padding: 8px 10px;
      background-color: var(--panel-color);
      border-left: 4px solid var(--ex-blue-accent);
    }

    .state {
      font-weight: bold;
    }

    .state.on {
      color: var(--green-text);
    }

    .state.off {
      color: var(--red-accent);
    }

    button {
      all: unset;
      box-sizing: border-box;
      display: block;
      width: 100%;
      text-align: center;
      padding: 9px;
      margin-top: 10px;
      border-radius: 3px;
      background-color: var(--green-background);
      color: var(--green-text);
      cursor: pointer;
    }

    button:hover:not(:disabled) {
      background-color: var(--green-highlight);
    }

    button:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .shortcut-row {
      display: flex;
      align-items: center;
      margin-top: 10px;
      font-size: 12px;
      color: #999;
    }

    kbd {
      font-family: monospace;
      font-size: 11px;
      background-color: var(--darker-panel-color);
      color: var(--blue-text);
      border-radius: 3px;
      padding: 2px 5px;
      margin: 0 5px;
    }

    .remap {
      display: inline-block;
      width: auto;
      margin: 0 0 0 auto;
      padding: 2px 6px;
      font-size: 11px;
      color: var(--blue-text);
      background-color: transparent;
    }

    .remap:hover {
      background-color: var(--blue-background);
    }

    .capture {
      margin-top: 10px;
      font-size: 12px;
      color: var(--blue-text);
    }

    .hint {
      color: #777;
    }

    .error {
      margin-top: 4px;
      font-size: 12px;
      color: var(--red-accent);
    }
  `;

  override shouldUpdate() {
    return this.isConnected;
  }

  @state()
  private _status: PopupStatus = 'loading';

  @state()
  private _anyOn = false;

  @state()
  private _version = '';

  @state()
  private _instanceCount = 0;

  @state()
  private _busy = false;

  @state()
  private _shortcut = '';

  @state()
  private _remapMode = false;

  @state()
  private _remapError = '';

  /** commands.update exists only in Firefox — Chrome remaps via its own manager. */
  @state()
  private _canRemap = false;

  private _tabId: number | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this._canRemap = typeof globalThis.browser.commands.update === 'function';
    this._init();
    globalThis.browser.commands.onCommand.addListener(this._onCommand);
  }

  override disconnectedCallback() {
    globalThis.browser.commands.onCommand.removeListener(this._onCommand);
    this._exitRemap();
    super.disconnectedCallback();
  }

  /**
   * Resolves the active tab, then asks the background for its game state
   * and the browser for the current shortcut binding.
   */
  private async _init() {
    try {
      const [tab] = await globalThis.browser.tabs.query({ active: true, currentWindow: true });
      this._tabId = tab?.id ?? null;
      if (this._tabId === null) {
        this._status = 'error';
        return;
      }
      this._applyReply(await this._send({ name: 'ex-debug:popup-get-state', tabId: this._tabId }));
    } catch {
      this._status = 'error';
    }
    void this._loadShortcut();
  }

  /**
   * Refreshes the game state when the browser-level shortcut fires while
   * the popup happens to be open (the background does the actual toggle).
   */
  private _onCommand = (command: string) => {
    if (command === COMMAND_NAME && !this._remapMode && !this._busy && this._tabId !== null) {
      void this._send({ name: 'ex-debug:popup-get-state', tabId: this._tabId })
        .then((reply) => this._applyReply(reply))
        .catch(() => {
          // background unreachable — the status line already says so
        });
    }
  };

  /**
   * Loads the current binding of the toggle-debug command ('' = unbound).
   */
  private async _loadShortcut() {
    try {
      const all = await globalThis.browser.commands.getAll();
      this._shortcut = all.find((command) => command.name === COMMAND_NAME)?.shortcut ?? '';
    } catch {
      this._shortcut = '';
    }
  }

  /**
   * Round-trips a popup request through the background's runtime.onMessage
   * handler; a missing reply (no listener answered) is treated as
   * unreachable rather than "no game".
   */
  private async _send(request: object): Promise<PopupStateReply> {
    const reply = await globalThis.browser.runtime.sendMessage(request);
    if (!reply || typeof reply !== 'object') {
      throw new Error('no reply from the devtools background');
    }
    return reply as PopupStateReply;
  }

  /**
   * Renders a state reply; zero instances means no game (or a tab the
   * extension cannot inject into).
   */
  private _applyReply(reply: PopupStateReply) {
    if (reply.instances.length === 0) {
      this._status = 'no-game';
      this._anyOn = false;
      this._version = '';
      this._instanceCount = 0;
    } else {
      this._status = 'ready';
      this._anyOn = reply.anyOn;
      this._version = reply.instances[0].version;
      this._instanceCount = reply.instances.length;
    }
  }

  /**
   * One press: toggle every detected game in the tab to the opposite of the
   * current aggregate state (mixed states converge).
   */
  private async _toggle() {
    if (this._busy || this._status !== 'ready' || this._tabId === null) {
      return;
    }
    this._busy = true;
    try {
      this._applyReply(await this._send({ name: 'ex-debug:popup-toggle-debug', tabId: this._tabId, value: !this._anyOn }));
    } catch {
      this._status = 'error';
    } finally {
      this._busy = false;
    }
  }

  /**
   * Starts remap capture: every keydown is swallowed by the popup until a
   * valid, unreserved combo is saved or the user backs out. Firefox only —
   * see _canRemap.
   */
  private _enterRemap() {
    if (this._remapMode) {
      return;
    }
    this._remapMode = true;
    this._remapError = '';
    document.addEventListener('keydown', this._remapKeydown, true);
    window.addEventListener('blur', this._exitRemap);
  }

  /**
   * Chrome ships no commands.update (that API is Firefox-only), so remapping
   * there is delegated to the browser's own shortcut manager page.
   */
  private async _openShortcutManager() {
    try {
      await globalThis.browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
    } catch {
      // the popup closes as the manager opens; a failure here is invisible
    }
  }

  /**
   * Ends remap capture and restores normal key handling.
   */
  private _exitRemap = () => {
    if (!this._remapMode) {
      return;
    }
    this._remapMode = false;
    this._remapError = '';
    document.removeEventListener('keydown', this._remapKeydown, true);
    window.removeEventListener('blur', this._exitRemap);
  };

  /**
   * Capture handler: Escape cancels; a complete combo that is not reserved
   * by the browser is persisted via commands.update.
   */
  private _remapKeydown = async (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      this._exitRemap();
      return;
    }
    const combo = comboFromEvent(e, IS_MAC);
    if (!combo) {
      // incomplete (modifiers only) or unusable — keep waiting
      return;
    }
    if (isReservedCombo(combo)) {
      this._remapError = 'That shortcut is reserved by the browser.';
      return;
    }
    try {
      await globalThis.browser.commands.update({ name: COMMAND_NAME, shortcut: combo });
      this._shortcut = combo;
      this._exitRemap();
    } catch (err) {
      this._remapError = `Could not save the shortcut${err instanceof Error ? `: ${err.message}` : ''}`;
    }
  };

  override render() {
    return html`
      <div class="status" role="status">${this._renderStatus()}</div>
      <button ?disabled=${this._status !== 'ready' || this._busy} @click=${this._toggle}>
        ${this._busy ? 'Working…' : 'Toggle Debug'}
      </button>
      ${this._remapMode
        ? html`
            <div class="capture">Press a new shortcut <span class="hint">(Esc cancels)</span></div>
            ${this._remapError ? html`<div class="error">${this._remapError}</div>` : nothing}
          `
        : html`
            <div class="shortcut-row">
              <span>Debug shortcut</span>
              <kbd>${this._shortcut ? prettifyCombo(this._shortcut, IS_MAC) : 'Not set'}</kbd>
              ${this._canRemap
                ? html`<button class="remap" @click=${this._enterRemap}>Remap</button>`
                : html`<button class="remap" @click=${this._openShortcutManager}>Change</button>`}
            </div>
          `}
    `;
  }

  private _renderStatus() {
    switch (this._status) {
      case 'loading':
        return 'Checking this tab for a game…';
      case 'no-game':
        return 'No Excalibur game detected in this tab.';
      case 'error':
        return 'Could not reach the devtools background.';
      case 'ready':
        return html`${this._version}${this._instanceCount > 1 ? ` · ${this._instanceCount} games` : ''} · debug draw
          <span class="state ${this._anyOn ? 'on' : 'off'}">${this._anyOn ? 'ON' : 'OFF'}</span>`;
    }
  }
}
