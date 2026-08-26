import { createConnection, type DriverPort } from './driver/connection';
import type { PageExecutor } from './driver/executor';

if (typeof browser == 'undefined') {
  // Chrome does not support the browser namespace yet.
  globalThis.browser = globalThis.chrome;
}

/**
 * Runs page functions in the inspected tab via chrome.scripting (world MAIN).
 * Rejections propagate — createConnection decides whether to swallow
 * (commands) or count heartbeat strikes (the poll).
 */
// chrome types the results as InjectionResult<Awaited<R>>[]; the page
// functions are all synchronous, so the Awaited wrapper is a no-op and the
// shape matches FrameResult — TS just can't relate the deferred conditional,
// hence the cast on the whole object
const scriptingExecutor = {
  exec: (
    tabId: number,
    frameId: number | null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    func: (...fnArgs: any[]) => unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args?: any[]
  ) =>
    globalThis.browser.scripting.executeScript({
      target: { tabId, frameIds: [frameId ?? 0] },
      world: 'MAIN',
      func,
      args
    }),
  execAll: (tabId: number, func: () => unknown) =>
    globalThis.browser.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: 'MAIN',
      func
    })
} as PageExecutor;

/**
 * Adapts a chrome runtime Port to the transport-agnostic DriverPort shape.
 */
const wrapPort = (port: chrome.runtime.Port): DriverPort => ({
  postMessage: (message) => port.postMessage(message),
  onMessage: (cb) => port.onMessage.addListener(cb),
  onDisconnect: (cb) => port.onDisconnect.addListener(cb)
});

globalThis.browser.runtime.onConnect.addListener((port) => {
  console.info('Connected:', port.name);
  const dispose = createConnection(wrapPort(port), scriptingExecutor);
  port.onDisconnect.addListener(() => {
    console.info('Disconnected:', port.name);
    dispose();
  });
});
