import { createLocalTransport } from './local-driver';
import type { PanelTransport } from '../panel-transport/types';

/**
 * Public API exposed as window.ExDevtools by the embedded build.
 */
export interface ExDevtoolsApi {
  /** Creates the dock and panel on first call, then shows them. */
  open(): void;
  /** Hides the dock; panel state (and the live connection) is kept. */
  close(): void;
  toggle(): void;
  /** Tears down the panel, connection, and all injected UI. */
  destroy(): void;
}

export interface ExDevtoolsHostOptions {
  /** Compiled panel bundle (panel-boot.ts) as text, injected into the iframe. */
  panelJs: string;
  /** Compiled panel stylesheet as text. */
  panelCss: string;
  /** Skip creating the floating toggle button. */
  hideButton?: boolean;
}

const DOCK_WIDTH_KEY = 'ex-devtools:dock-width';

/**
 * Creates the embedded devtools host in the current (game) page: a floating
 * toggle button and a right-side dock holding the panel iframe.
 *
 * Realm split: the driver connection and page functions run HERE, in the
 * game's realm (they must see window.___EXCALIBUR_DEVTOOL); only the panel UI
 * lives in the iframe, talking through the transport bridge. Every host
 * element carries data-ex-devtools-ui so the entity picker ignores it.
 */
export function createExDevtools(options: ExDevtoolsHostOptions): ExDevtoolsApi {
  let button: HTMLButtonElement | undefined;
  let dock: HTMLDivElement | undefined;
  let activeTransport: PanelTransport | undefined;
  let destroyed = false;

  const transportFactory = () => {
    // Track the panel's current transport so destroy() can stop the driver
    // even after the iframe's document is discarded (iframe teardown never
    // fires disconnectedCallback, so the panel can't do it itself)
    activeTransport = createLocalTransport();
    return activeTransport;
  };

  /** Builds the dock, splitter, close button, and panel iframe on first open. */
  const createDock = () => {
    dock = document.createElement('div');
    dock.setAttribute('data-ex-devtools-ui', '');
    let width = 420;
    try {
      width = Number(localStorage.getItem(DOCK_WIDTH_KEY)) || width;
    } catch {
      // storage unavailable; default width
    }
    dock.style.cssText = [
      'position:fixed',
      'top:0',
      'right:0',
      'bottom:0',
      `width:${width}px`,
      'z-index:2147483646',
      'background:#292929',
      'border-left:2px solid #176baa',
      'box-shadow:-4px 0 16px rgba(0,0,0,0.5)',
      'display:flex',
      'flex-direction:row'
    ].join(';');

    const splitter = document.createElement('div');
    splitter.setAttribute('data-ex-devtools-ui', '');
    splitter.style.cssText = 'width:6px;cursor:ew-resize;flex:0 0 auto;touch-action:none;';
    splitter.addEventListener('pointerdown', (down) => {
      down.preventDefault();
      splitter.setPointerCapture(down.pointerId);
      const startX = down.clientX;
      const startWidth = dock!.offsetWidth;
      const onMove = (move: PointerEvent) => {
        const newWidth = Math.min(window.innerWidth - 60, Math.max(200, startWidth + (startX - move.clientX)));
        dock!.style.width = `${newWidth}px`;
      };
      const onUp = () => {
        splitter.removeEventListener('pointermove', onMove);
        splitter.removeEventListener('pointerup', onUp);
        try {
          localStorage.setItem(DOCK_WIDTH_KEY, String(dock!.offsetWidth));
        } catch {
          // best-effort only
        }
      };
      splitter.addEventListener('pointermove', onMove);
      splitter.addEventListener('pointerup', onUp);
    });
    dock.appendChild(splitter);

    const content = document.createElement('div');
    content.setAttribute('data-ex-devtools-ui', '');
    content.style.cssText = 'flex:1 1 auto;display:flex;flex-direction:column;min-width:0;';

    const header = document.createElement('div');
    header.setAttribute('data-ex-devtools-ui', '');
    header.style.cssText = 'flex:0 0 auto;display:flex;justify-content:flex-end;padding:4px;';
    const closeButton = document.createElement('button');
    closeButton.setAttribute('data-ex-devtools-ui', '');
    closeButton.setAttribute('aria-label', 'Close Excalibur devtools');
    closeButton.textContent = '✕';
    closeButton.style.cssText = [
      'width:24px',
      'height:24px',
      'border-radius:4px',
      'border:1px solid #176baa',
      'background:#1e1e1e',
      'color:#48edf1',
      'font:bold 12px sans-serif',
      'line-height:1',
      'cursor:pointer'
    ].join(';');
    closeButton.addEventListener('click', () => api.close());
    header.appendChild(closeButton);
    content.appendChild(header);

    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-ex-devtools-ui', '');
    iframe.style.cssText = 'border:0;flex:1 1 auto;width:100%;';
    content.appendChild(iframe);

    dock.appendChild(content);
    document.body.appendChild(dock);

    // Same-origin about:blank; build the panel document by hand. The bridge
    // must exist before the panel script runs.
    const idoc = iframe.contentDocument!;
    (iframe.contentWindow as unknown as Record<string, unknown>).__EX_DEVTOOLS_BRIDGE__ = { transportFactory };
    idoc.documentElement.className = 'sl-theme-dark';
    const style = idoc.createElement('style');
    style.textContent = options.panelCss;
    idoc.head.appendChild(style);
    const script = idoc.createElement('script');
    script.type = 'module';
    script.textContent = options.panelJs;
    idoc.body.appendChild(script);
  };

  const api: ExDevtoolsApi = {
    open: () => {
      if (destroyed) {
        return;
      }
      if (!dock) {
        createDock();
      }
      dock!.style.display = 'flex';
      if (button) {
        button.style.display = 'none';
      }
    },
    close: () => {
      if (dock) {
        dock.style.display = 'none';
      }
      if (button && !destroyed) {
        button.style.display = 'block';
      }
    },
    toggle: () => {
      if (!dock || dock.style.display === 'none') {
        api.open();
      } else {
        api.close();
      }
    },
    destroy: () => {
      destroyed = true;
      activeTransport?.disconnect();
      activeTransport = undefined;
      dock?.remove();
      dock = undefined;
      button?.remove();
      button = undefined;
    }
  };

  if (!options.hideButton) {
    button = document.createElement('button');
    button.setAttribute('data-ex-devtools-ui', '');
    button.setAttribute('aria-label', 'Open Excalibur devtools');
    button.textContent = 'Ex';
    button.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483647',
      'width:44px',
      'height:44px',
      'border-radius:50%',
      'border:2px solid #176baa',
      'background:#1e1e1e',
      'color:#48edf1',
      'font:bold 14px sans-serif',
      'cursor:pointer',
      'box-shadow:0 2px 8px rgba(0,0,0,0.5)'
    ].join(';');
    button.addEventListener('click', () => api.open());
    document.body.appendChild(button);
  }

  return api;
}
