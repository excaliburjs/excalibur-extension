import { createConnection, type DriverPort } from '../driver/connection';
import type { PageExecutor } from '../driver/executor';
import type { PanelTransport } from '../panel-transport/types';
import type { EventDispatchEvents } from '../protocol';

/**
 * Runs page functions by calling them directly in the current realm — the
 * embedded equivalent of chrome.scripting.executeScript. There is exactly one
 * frame (frameId 0). Rejects when the function throws, mirroring an
 * executeScript failure, so createConnection's swallow/strike handling
 * applies unchanged.
 */
export const directExecutor: PageExecutor = {
  exec: (_tabId, _frameId, func, args) => {
    try {
      return Promise.resolve([{ frameId: 0, result: func(...(args ?? [])) }]);
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }
  },
  execAll: (_tabId, func) => directExecutor.exec(_tabId, 0, func)
};

/**
 * Creates a PanelTransport wired to an in-memory driver connection running in
 * this page — no extension, no ports, no service worker. The page functions
 * run in the calling realm, so this must be constructed in the page that owns
 * `window.___EXCALIBUR_DEVTOOL` (the game page), even when the panel UI lives
 * in an iframe.
 *
 * Both directions deliver messages on a microtask so the panel can register
 * its callbacks after construction, exactly like a chrome Port connect.
 */
export function createLocalTransport(executor: PageExecutor = directExecutor): PanelTransport {
  let driverCb: ((message: object) => void) | undefined;
  let driverDisconnectCb: (() => void) | undefined;
  let panelCb: ((message: EventDispatchEvents) => void) | undefined;
  let disconnected = false;

  const driverPort: DriverPort = {
    postMessage: (message) => {
      queueMicrotask(() => {
        if (!disconnected) {
          panelCb?.(message as EventDispatchEvents);
        }
      });
    },
    onMessage: (cb) => {
      driverCb = cb;
    },
    onDisconnect: (cb) => {
      driverDisconnectCb = cb;
    }
  };

  const disposeConnection = createConnection(driverPort, executor);

  const post = (message: object) => {
    if (disconnected) {
      throw new Error('local transport is disconnected');
    }
    // The transport owns tabId stamping; there is only ever "this tab"
    const stamped = { ...message, tabId: 0 };
    queueMicrotask(() => {
      if (!disconnected) {
        driverCb?.(stamped);
      }
    });
  };

  post({ name: 'ex-debug:hello' });

  return {
    post,
    onMessage: (cb) => {
      panelCb = cb;
    },
    onDisconnect: () => {
      // The local driver lives in the same page as the panel and never goes
      // away on its own; the callback would never fire
    },
    disconnect: () => {
      disconnected = true;
      panelCb = undefined;
      driverDisconnectCb?.();
      disposeConnection();
    }
  };
}
