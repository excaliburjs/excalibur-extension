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

const DOCK_HEIGHT_KEY = 'ex-devtools:dock-height';

/**
 * Creates the embedded devtools host in the current (game) page: a floating
 * toggle button and a bottom dock holding the panel iframe.
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

  /** Builds the dock, splitter, and panel iframe on first open. */
  const createDock = () => {
    dock = document.createElement('div');
    dock.setAttribute('data-ex-devtools-ui', '');
    let height = 380;
    try {
      height = Number(localStorage.getItem(DOCK_HEIGHT_KEY)) || height;
    } catch {
      // storage unavailable; default height
    }
    dock.style.cssText = [
      'position:fixed',
      'left:0',
      'right:0',
      'bottom:0',
      `height:${height}px`,
      'z-index:2147483646',
      'background:#292929',
      'border-top:2px solid #176baa',
      'box-shadow:0 -4px 16px rgba(0,0,0,0.5)',
      'display:flex',
      'flex-direction:column'
    ].join(';');

    const splitter = document.createElement('div');
    splitter.setAttribute('data-ex-devtools-ui', '');
    splitter.style.cssText = 'height:6px;cursor:ns-resize;flex:0 0 auto;touch-action:none;';
    splitter.addEventListener('pointerdown', (down) => {
      down.preventDefault();
      splitter.setPointerCapture(down.pointerId);
      const startY = down.clientY;
      const startHeight = dock!.offsetHeight;
      const onMove = (move: PointerEvent) => {
        const newHeight = Math.min(window.innerHeight - 60, Math.max(160, startHeight + (startY - move.clientY)));
        dock!.style.height = `${newHeight}px`;
      };
      const onUp = () => {
        splitter.removeEventListener('pointermove', onMove);
        splitter.removeEventListener('pointerup', onUp);
        try {
          localStorage.setItem(DOCK_HEIGHT_KEY, String(dock!.offsetHeight));
        } catch {
          // best-effort only
        }
      };
      splitter.addEventListener('pointermove', onMove);
      splitter.addEventListener('pointerup', onUp);
    });
    dock.appendChild(splitter);

    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-ex-devtools-ui', '');
    iframe.style.cssText = 'border:0;flex:1 1 auto;width:100%;';
    dock.appendChild(iframe);
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
