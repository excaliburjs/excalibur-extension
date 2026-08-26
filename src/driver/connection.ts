import { DefaultSettings, settingsMappings } from '../settings/schema';
import type { ExInstance } from '../protocol';
import type { PageExecutor } from './executor';
import { detectExcalibur } from '../page/detect';
import { stepClock, stopClock, startClock, toggleTestClock } from '../page/clock';
import { kill, identifyEntity, updateEntityProperty, getEntityGraphics, useEntityGraphic } from '../page/entities';
import { startEntityPicker, stopEntityPicker, setPickerIgnored } from '../page/picker';
import { setColorBlind, goToScene, updatePhysics } from '../page/scene';
import { updateMaterialUniform, getMaterialDetail } from '../page/materials';
import { inject } from '../page/inject';

/**
 * The port a panel connection talks over: a chrome runtime Port in the
 * extension, an in-memory pair in the embedded build.
 */
export interface DriverPort {
  postMessage(message: object): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onMessage(cb: (message: any) => void): void;
  onDisconnect(cb: () => void): void;
}

/**
 * Creates the default debug settings for a panel connection. Each connection
 * gets its own copy so panels on different tabs never share state and a
 * closed panel's settings (e.g. collectMaterials) can't leak into the next.
 *
 * Every schema-defined setting is derived from `DefaultSettings` — the schema
 * in src/settings/schema.ts is the single source of truth, so a setting added
 * there is automatically known to the connection and applied by `inject`.
 * Only the connection-lifecycle fields below live outside the schema.
 */
const createDefaultDebugSettings = () => ({
  collectMaterials: false,
  inspectEntityId: null as number | null,
  pickerActive: false,
  toggleDebug: undefined as boolean | undefined,
  // Deep-copied so a connection mutating a color can never bleed into the
  // shared schema default objects
  ...(JSON.parse(JSON.stringify(DefaultSettings)) as typeof DefaultSettings)
});

/**
 * Everything one panel connection needs, independent of transport: the
 * command dispatch, the 200ms heartbeat poll with its 3-strike failure
 * tolerance, frame-selection reconciliation, and the pickerOpSeq guard that
 * serializes picker arm/disarm across async installs.
 *
 * Returns a dispose function; it is also wired to the port's disconnect.
 */
export function createConnection(port: DriverPort, executor: PageExecutor): () => void {
  const state: { tabId: number | null; selectedFrameId: number | null } = {
    tabId: null,
    selectedFrameId: null
  };

  // Per-connection settings: panels on different tabs must not share state
  const debugSettings = createDefaultDebugSettings();

  let pickerOpSeq = 0;

  let disconnected = false;

  /**
   * Posts to the panel unless the port is already gone; async work (the
   * heartbeat, command replies) can resolve after the panel closes.
   */
  const safePostMessage = (message: object) => {
    if (disconnected) {
      return;
    }
    try {
      port.postMessage(message);
    } catch {
      disconnected = true;
    }
  };

  /**
   * Runs a page function for a command, swallowing rejections from
   * non-injectable targets (chrome:// pages, dead tabs) — command failures
   * must never take the connection down.
   */
  const execCommand = (
    tabId: number,
    frameId: number | null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    func: (...fnArgs: any[]) => unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args?: any[]
  ) => {
    return executor.exec(tabId, frameId, func, args).catch((e) => {
      console.info('page exec failed:', e);
      return [];
    });
  };

  port.onMessage((message) => {
    console.info('Received message:', message);

    // https://parceljs.org/recipes/web-extension/#unexpected-messages
    if (message.__parcel_hmr_reload__) {
      return;
    }

    if (message.name === 'ex-debug:hello') {
      state.tabId = message.tabId;
      return;
    }

    if (message.name === 'ex-debug:command') {
      switch (message.dispatch) {
        case 'ex-debug:select-frame':
          {
            if (debugSettings.pickerActive) {
              // the picker lives in the previously selected frame only
              pickerOpSeq++;
              debugSettings.pickerActive = false;
              execCommand(message.tabId, state.selectedFrameId, stopEntityPicker);
            }
            state.selectedFrameId = message.frameId;
          }
          break;
        case 'ex-debug:toggle-test-clock':
          {
            execCommand(message.tabId, state.selectedFrameId, toggleTestClock);
          }
          break;
        case 'ex-debug:step-clock':
          {
            execCommand(message.tabId, state.selectedFrameId, stepClock, [message.stepMs]);
          }
          break;
        case 'ex-debug:start-clock':
          {
            execCommand(message.tabId, state.selectedFrameId, startClock);
          }
          break;
        case 'ex-debug:stop-clock':
          {
            execCommand(message.tabId, state.selectedFrameId, stopClock);
          }
          break;
        case 'ex-debug:kill':
          {
            execCommand(message.tabId, state.selectedFrameId, kill, [message.actorId]);
          }
          break;
        case 'ex-debug:color-blind':
          {
            execCommand(message.tabId, state.selectedFrameId, setColorBlind, [message.colorBlindMode]);
          }
          break;
        case 'ex-debug:goto-scene':
          {
            execCommand(message.tabId, state.selectedFrameId, goToScene, [message.sceneName]);
          }
          break;
        case 'ex-debug:identify-actor':
          {
            execCommand(message.tabId, state.selectedFrameId, identifyEntity, [message.actorId]);
          }
          break;
        case 'ex-debug:update-debug':
          {
            // Simply merge all settings from the message
            Object.assign(debugSettings, message.debug);
          }
          break;
        case 'ex-debug:update-physics':
          {
            execCommand(message.tabId, state.selectedFrameId, updatePhysics, [message.physics]);
          }
          break;
        case 'ex-debug:materials-active':
          {
            debugSettings.collectMaterials = !!message.active;
          }
          break;
        case 'ex-debug:update-material-uniform':
          {
            execCommand(message.tabId, state.selectedFrameId, updateMaterialUniform, [message.update]);
          }
          break;
        case 'ex-debug:get-material-detail':
          {
            execCommand(message.tabId, state.selectedFrameId, getMaterialDetail, [
              { materialId: message.materialId, materialName: message.materialName }
            ])
              .then((results) => {
                safePostMessage({
                  name: 'ex-debug:material-detail',
                  data: results?.[0]?.result ?? null
                });
              })
              .catch((e) => {
                console.info('material detail reply failed:', e);
              });
          }
          break;
        case 'ex-debug:inspect-entity':
          {
            debugSettings.inspectEntityId = message.entityId ?? null;
          }
          break;
        case 'ex-debug:picker-start':
          {
            // Arm the flag only after install resolves so a heartbeat can't
            // observe pickerActive with no page global and wrongly disarm
            const op = ++pickerOpSeq;
            const frameId = state.selectedFrameId;
            execCommand(message.tabId, frameId, startEntityPicker, [message.ignoredCtors ?? [], message.ignoredNames ?? []]).then(() => {
              if (op === pickerOpSeq) {
                debugSettings.pickerActive = true;
              } else {
                // a stop/frame-switch/disconnect raced this install; tear
                // down the picker it left behind in the original frame
                execCommand(message.tabId, frameId, stopEntityPicker);
              }
            });
          }
          break;
        case 'ex-debug:picker-stop':
          {
            pickerOpSeq++;
            debugSettings.pickerActive = false;
            execCommand(message.tabId, state.selectedFrameId, stopEntityPicker);
          }
          break;
        case 'ex-debug:picker-set-ignored':
          {
            execCommand(message.tabId, state.selectedFrameId, setPickerIgnored, [message.ignoredCtors ?? [], message.ignoredNames ?? []]);
          }
          break;
        case 'ex-debug:get-entity-graphics':
          {
            execCommand(message.tabId, state.selectedFrameId, getEntityGraphics, [{ entityId: message.entityId }])
              .then((results) => {
                safePostMessage({
                  name: 'ex-debug:entity-graphics',
                  data: results?.[0]?.result ?? null
                });
              })
              .catch((e) => {
                console.info('entity graphics reply failed:', e);
              });
          }
          break;
        case 'ex-debug:update-entity-property':
          {
            execCommand(message.tabId, state.selectedFrameId, updateEntityProperty, [message.update]);
          }
          break;
        case 'ex-debug:use-entity-graphic':
          {
            execCommand(message.tabId, state.selectedFrameId, useEntityGraphic, [
              { entityId: message.entityId, graphicName: message.graphicName, source: message.source }
            ]);
          }
          break;
        default:
          console.info('Unhandled dispatch:', message.dispatch);
          break;
      }
    }
  });

  safePostMessage({
    name: 'ex-debug:init'
  });

  let failedHeartbeatTicks = 0;

  // Poll the inspected tab every 200ms once the panel has said hello
  const intervalId = setInterval(async () => {
    const tabId = state.tabId;
    if (tabId === null) {
      return;
    }
    try {
      const detected = await executor.execAll(tabId, detectExcalibur);
      const instances: ExInstance[] = [];
      for (const frame of detected) {
        if (frame && frame.result) {
          instances.push({ frameId: frame.frameId, ...frame.result });
        }
      }
      // Reconcile the selection: keep it while its frame still has a game,
      // otherwise prefer the top frame, then the first instance found
      if (!instances.some((i) => i.frameId === state.selectedFrameId)) {
        if (debugSettings.pickerActive && state.selectedFrameId !== null) {
          // the armed picker lives in the frame that just lost its game
          // (e.g. HMR cleared the global while the document survived);
          // tear it down or its click swallowers outlive the selection
          pickerOpSeq++;
          debugSettings.pickerActive = false;
          execCommand(tabId, state.selectedFrameId, stopEntityPicker);
        }
        state.selectedFrameId = instances.some((i) => i.frameId === 0) ? 0 : instances.length > 0 ? instances[0].frameId : null;
      }
      let data: string | null = null;
      if (state.selectedFrameId !== null) {
        const gameState = await executor.exec(tabId, state.selectedFrameId, inject, [debugSettings, settingsMappings]);
        data = gameState[0]?.result ?? null;
      }
      failedHeartbeatTicks = 0;
      safePostMessage({
        name: 'ex-debug:heartbeat',
        instances,
        selectedFrameId: state.selectedFrameId,
        data
      });
    } catch {
      // Non-injectable target (chrome:// page, dead tab) or a transient
      // executeScript failure. Skip a couple of ticks before telling the
      // panel there is nothing here — the panel keeps its last state and
      // its staleness detector (1.5s) stays well clear — while a
      // persistent failure still surfaces within ~600ms
      failedHeartbeatTicks++;
      if (failedHeartbeatTicks < 3) {
        return;
      }
      safePostMessage({
        name: 'ex-debug:heartbeat',
        instances: [],
        selectedFrameId: null,
        data: null
      });
    }
  }, 200);

  /**
   * Tears the connection down: stops the poll, invalidates in-flight picker
   * installs, and never leaves the page swallowing canvas clicks.
   */
  // NOT guarded by `disconnected` — a failed post sets that flag without
  // running cleanup, and the real disconnect must still clear the interval
  let disposed = false;
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    disconnected = true;
    clearInterval(intervalId);
    // invalidate any in-flight picker install so its .then tears it down
    // instead of arming a picker nobody can disarm
    pickerOpSeq++;
    if (debugSettings.pickerActive && state.tabId !== null) {
      debugSettings.pickerActive = false;
      executor.exec(state.tabId, state.selectedFrameId, stopEntityPicker).catch(() => {
        // page already gone
      });
    }
  };

  port.onDisconnect(dispose);

  return dispose;
}
