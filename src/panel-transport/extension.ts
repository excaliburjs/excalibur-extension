import type { EventDispatchEvents } from '../protocol';
import type { PanelTransport } from './types';

/**
 * The extension transport: a long-lived runtime Port to the background
 * service worker. This module is the ONLY panel-side code that touches
 * `browser.*` — and only at call time, so bundling it into the embedded
 * build (where it is never invoked) is harmless.
 */
export function createExtensionTransport(): PanelTransport {
  globalThis.browser = globalThis.browser || globalThis.chrome;

  const port = browser.runtime.connect({ name: 'panel' });
  const tabId = browser.devtools.inspectedWindow.tabId;

  let messageCb: ((message: EventDispatchEvents) => void) | undefined;
  let disconnectCb: (() => void) | undefined;
  const onMessage = (message: EventDispatchEvents) => messageCb?.(message);
  const onDisconnect = () => disconnectCb?.();
  port.onMessage.addListener(onMessage);
  port.onDisconnect.addListener(onDisconnect);

  // Tell the background which tab this panel inspects so the heartbeat
  // polls the right tab instead of whichever tab is focused
  port.postMessage({ name: 'ex-debug:hello', tabId });

  return {
    post: (message) => port.postMessage({ ...message, tabId }),
    onMessage: (cb) => {
      messageCb = cb;
    },
    onDisconnect: (cb) => {
      disconnectCb = cb;
    },
    disconnect: () => {
      // Stop delivery before disconnecting so no message lands mid-teardown
      messageCb = undefined;
      disconnectCb = undefined;
      port.onMessage.removeListener(onMessage);
      port.onDisconnect.removeListener(onDisconnect);
      try {
        port.disconnect();
      } catch {
        // port already dead
      }
    }
  };
}
