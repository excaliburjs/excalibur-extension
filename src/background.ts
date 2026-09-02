import { collectInstances, createConnection, type ConnectionHandle, type ConnectionHooks, type DriverPort } from './driver/connection';
import type { ExInstance, PopupStateReply } from './protocol';
import type { PageExecutor } from './driver/executor';
import { detectExcalibur } from './page/detect';
import { quickToggleDebug } from './page/debug';

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

/**
 * Every live panel connection. The popup routes tab-scoped actions (the
 * quick debug toggle) through the handles inspecting that tab.
 */
const connections = new Set<ConnectionHandle>();

/** Last badge text set per tab, so steady state never re-calls the action API. */
const badgeTextByTab = new Map<number, string>();

/** The badge background color is set once per worker lifetime. */
let badgeColorInitialized = false;

/**
 * Mirrors the game's debug state onto the toolbar badge for one tab.
 * Opportunistic by design: only popup actions and live panel heartbeats
 * refresh it, so it can go stale with neither open — accepted.
 */
const updateBadge = (tabId: number | null, anyOn: boolean) => {
  if (tabId === null) {
    return;
  }
  if (!badgeColorInitialized) {
    badgeColorInitialized = true;
    globalThis.browser.action.setBadgeBackgroundColor({ color: '#25a786' });
  }
  const text = anyOn ? 'ON' : '';
  if (badgeTextByTab.get(tabId) === text) {
    return;
  }
  badgeTextByTab.set(tabId, text);
  globalThis.browser.action.setBadgeText({ tabId, text });
};

const connectionHooks: ConnectionHooks = {
  // the badge follows the heartbeat's detection pass; clearing on navigation
  // comes from the zero-instances change
  onInstancesChanged: (tabId, instances) => {
    updateBadge(
      tabId,
      instances.some((i) => i.isDebug)
    );
  }
};

globalThis.browser.runtime.onConnect.addListener((port) => {
  console.info('Connected:', port.name);
  const connection = createConnection(wrapPort(port), scriptingExecutor, connectionHooks);
  connections.add(connection);
  port.onDisconnect.addListener(() => {
    console.info('Disconnected:', port.name);
    connections.delete(connection);
    connection.dispose();
  });
});

/**
 * Detects the Excalibur instances across all frames of a tab — the same
 * pass (and same aggregation, via the driver's collectInstances) as the
 * heartbeat poll; shared by both popup handlers.
 */
const detectInstances = async (tabId: number): Promise<ExInstance[]> =>
  collectInstances(await scriptingExecutor.execAll(tabId, detectExcalibur));

/**
 * `ex-debug:popup-get-state`: everything the popup renders from — the
 * detected instances and whether any of them has debug on.
 */
const handlePopupGetState = async (tabId: number): Promise<PopupStateReply> => {
  const instances = await detectInstances(tabId);
  return { instances, anyOn: instances.some((i) => i.isDebug) };
};

/**
 * `ex-debug:popup-toggle-debug`: toggles every detected instance in the tab
 * to the target state, then makes every live panel connection on that tab
 * adopt the value — a connection with a user-set toggleDebug would otherwise
 * clobber the toggle on its next 200ms inject tick.
 */
const handlePopupToggleDebug = async (tabId: number, value: boolean): Promise<PopupStateReply> => {
  const instances = await detectInstances(tabId);
  if (instances.length === 0) {
    return { instances, anyOn: false };
  }
  // allSettled: one dead frame must not fail the toggle in the rest
  const settled = await Promise.allSettled(
    instances.map((instance) => scriptingExecutor.exec(tabId, instance.frameId, quickToggleDebug, [value]))
  );
  const after: ExInstance[] = [];
  settled.forEach((result, i) => {
    const frame = result.status === 'fulfilled' ? result.value?.[0] : undefined;
    if (frame?.result) {
      after.push({ ...instances[i], isDebug: !!frame.result.isDebug });
    }
  });
  const anyOn = after.some((i) => i.isDebug);
  for (const connection of connections) {
    if (connection.getTabId() === tabId) {
      connection.externalDebugToggle(value);
    }
  }
  updateBadge(tabId, anyOn);
  return { instances: after, anyOn };
};

/**
 * One-shot requests from the toolbar popup (runtime.sendMessage — the popup
 * never connects a port and never touches the page itself).
 */
type PopupRequest =
  | { name: 'ex-debug:popup-get-state'; tabId: number }
  | { name: 'ex-debug:popup-toggle-debug'; tabId: number; value: boolean };

globalThis.browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // https://parceljs.org/recipes/web-extension/#unexpected-messages
  if (!message || message.__parcel_hmr_reload__) {
    return;
  }
  const request = message as PopupRequest;
  let work: Promise<PopupStateReply> | undefined;
  if (request.name === 'ex-debug:popup-get-state') {
    work = handlePopupGetState(request.tabId);
  } else if (request.name === 'ex-debug:popup-toggle-debug') {
    work = handlePopupToggleDebug(request.tabId, !!request.value);
  }
  if (!work) {
    return;
  }
  // Rejections (non-injectable tabs, dead tabs) must still answer the popup
  work.then(sendResponse).catch(() => sendResponse({ instances: [], anyOn: false }));
  // async sendResponse — without `true` the port closes before the reply
  return true;
});

/**
 * The browser-level shortcut ("toggle-debug" command, default Alt+Shift+D —
 * chosen because no major browser or web app binds it; remappable via the
 * popup or the browser's own shortcut manager). Behaves exactly like the
 * popup's button: toggle every detected game in the active tab, make live
 * panel connections adopt the value, mirror the badge. Silent no-op on tabs
 * without a game.
 */
globalThis.browser.commands.onCommand.addListener((command: string) => {
  if (command !== 'toggle-debug') {
    return;
  }
  void (async () => {
    const [tab] = await globalThis.browser.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id;
    if (tabId === undefined) {
      return;
    }
    const state = await handlePopupGetState(tabId);
    await handlePopupToggleDebug(tabId, !state.anyOn);
  })().catch(() => {
    // non-injectable or dead tab — a shortcut press must never surface UI
  });
});
