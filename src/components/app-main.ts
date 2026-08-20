import { css, html, LitElement } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import logoImg from '../../res/logo-white@2x.png';

import './debug-settings';
import './entity-list';
import './fps-graph';
import './frame-time-graph';
import './system-time-graph';
import './flame-chart';
import './stats-list';
import './system-stats-list';
import './scene-list';
import './physics-settings';
import './screen-camera';
import './materials-panel';
import './no-excalibur-overlay';
import './screen-debug-settings';
import './entity-inspector';
import { colors } from '../colors';
import { common } from '../common';
import { Settings } from './debug-settings';
import { settingsStore } from '../settings';
import { FpsGraph } from './fps-graph';
import { FrameTimeGraph } from './frame-time-graph';
import { Stats } from './stats-list';
import { FlameChart } from './flame-chart';
import { SlChangeEvent, SlInput, SlRadioGroup, SlSelect } from '@shoelace-style/shoelace';
import { Entity } from './entity-list';
import { DefaultPhysicsSettings, Physics } from './physics-settings';
import { BoundingBox, DisplayMode, EngineOptions, Resolution, ViewportDimension } from '../@types/excalibur';
import { SystemTimeGraph } from './system-time-graph';
import { SystemStatsList } from './system-stats-list';
import { MaterialDetail, MaterialsState, UniformChange } from './material-detail';
import { MaterialSelected } from './materials-panel';
import type { EntityGraphicsDetail, EntityPropertyUpdate, ExInstance, HeartbeatMessage, InspectedEntity, PickerState } from '../protocol';

globalThis.browser = globalThis.browser || globalThis.chrome;

interface Point {
  _x: number;
  _y: number;
}

interface Pointer {
  worldPos: Point;
  screenPos: Point;
  pagePos: Point;
}

interface Engine {
  version: string;
  currentScene: string;
  scenes: string[];
  entities: Entity[];
  pointer: Pointer | null;
}

interface Camera {
  pos: Point;
  vel: Point;
  acc: Point;
  strategies: { name: string }[];
}

interface ScreenState {
  viewport: ViewportDimension;
  resolution: Resolution;
  displayMode: DisplayMode;
  pixelRatio: number;
  unsafeArea: BoundingBox;
  contentArea: BoundingBox;
}

interface InitEvent {
  name: 'ex-debug:init';
}

interface MaterialDetailEvent {
  name: 'ex-debug:material-detail';
  data: string | null;
}

interface EntityGraphicsEvent {
  name: 'ex-debug:entity-graphics';
  data: string | null;
}

type EventDispatchEvents = InitEvent | HeartbeatMessage | MaterialDetailEvent | EntityGraphicsEvent;

@customElement('app-main')
export class App extends LitElement {
  static styles = [
    colors,
    common,
    css`
      :host {
        display: block;
        font-family: sans-serif;
        font-size: 16px;
        margin: 0;
        padding: 0;
        background-color: var(--background-color);
        color: #ccc;
      }
      h1 {
        margin: 5px;
        display: flex;
        align-items: center;
      }

      h1 img {
        max-height: 70px;
        margin-left: -40px;
        margin-right: -40px;
      }

      h2 {
        position: relative;
        background-color: var(--panel-color);
        padding: 10px;
        margin-top: 0;
        margin-bottom: 10px;
      }

      h2::before {
        content: '';
        position: absolute;
        left: -5px;
        top: 0;
        height: 100%;
        border-left: 5px solid var(--ex-blue-accent);
      }

      h3 {
        position: relative;
        padding: 0;
        margin-top: 0;
        margin-bottom: 10px;
      }

      .version {
        margin-left: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .version sl-select {
        min-width: 300px;
      }
      sl-radio {
        margin-bottom: 5px;
      }
    `
  ];
  @query('fps-graph')
  fpsGraph!: FpsGraph;

  @query('system-time-graph')
  systemTimeGraph!: SystemTimeGraph;

  @query('system-stats-list')
  systemStatsList!: SystemStatsList;

  @query('frame-time-graph')
  frameTimeGraph!: FrameTimeGraph;

  @query('flame-chart')
  flameChart!: FlameChart;

  @state({
    hasChanged: (newValue, oldValue) => JSON.stringify(newValue) !== JSON.stringify(oldValue)
  })
  engine: Engine = {
    version: '???',
    currentScene: 'root',
    scenes: [],
    entities: [],
    pointer: null
  };

  // Settings are now managed by settingsStore
  // Kept for backward compatibility with the template binding
  get settings(): Settings {
    return settingsStore.getAll();
  }

  @state({
    hasChanged: (newValue, oldValue) => JSON.stringify(newValue) !== JSON.stringify(oldValue)
  })
  stats: Stats = {
    fps: 0,
    delta: 0,
    frameTime: 0,
    updateTime: 0,
    drawTime: 0,
    frameBudget: 0,
    drawCalls: 0,
    numActors: 0,
    rendererSwaps: 0,
    systemDuration: {}
  };

  @state({
    hasChanged: (newValue, oldValue) => JSON.stringify(newValue) !== JSON.stringify(oldValue)
  })
  physics: Physics = DefaultPhysicsSettings;

  @state({
    hasChanged: (newValue, oldValue) => JSON.stringify(newValue) !== JSON.stringify(oldValue)
  })
  materials: MaterialsState = { source: 'scan', list: [] };

  @state()
  materialDetails: Record<string, MaterialDetail> = {};

  @state()
  inspectedEntityId: number | null = null;

  @state({
    hasChanged: (newValue, oldValue) => JSON.stringify(newValue) !== JSON.stringify(oldValue)
  })
  inspectedEntity: InspectedEntity | null = null;

  @state()
  entityGraphics: EntityGraphicsDetail | null = null;

  private _fetchedGraphicsKey: string | null = null;

  @state()
  pickerArmed = false;

  private _pickerArmedAt = 0;
  private _lastPickSeq = 0;

  @state()
  worldPos: string = '???';

  @state()
  screenPos: string = '???';

  @state()
  pagePos: string = '???';

  @state({
    hasChanged: (newValue, oldValue) => JSON.stringify(newValue) !== JSON.stringify(oldValue)
  })
  instances: ExInstance[] = [];

  @state()
  selectedFrameId: number | null = null;

  @state()
  hasReceivedHeartbeat: boolean = false;

  @state()
  connectionLost: boolean = false;

  toggleDebug: boolean = false;

  private _toggleDebugUserSet: boolean = false;

  private _currentTabName: string = 'inspector';

  private _lastHeartbeatAt: number = 0;
  private _stalenessIntervalId?: ReturnType<typeof setInterval>;
  private _reconnectTimerId?: ReturnType<typeof setTimeout>;
  private _reconnectDelayMs: number = 500;
  private _hasInitialized: boolean = false;

  backgroundConnection!: browser.runtime.Port;
  camera: Camera = {
    pos: { _x: 0, _y: 0 },
    vel: { _x: 0, _y: 0 },
    acc: { _x: 0, _y: 0 },
    strategies: []
  };

  config: EngineOptions = {};
  screen: ScreenState = {} as unknown as ScreenState;

  isV31OrLater: boolean = false;
  isV32OrLater: boolean = false;
  isV33OrLater: boolean = false;

  override shouldUpdate() {
    return this.isConnected;
  }

  override firstUpdated(): void {
    this.connectToExtension();

    // If heartbeats stop arriving without the port firing onDisconnect
    // (a wedged service worker), tear the port down and reconnect
    this._stalenessIntervalId = setInterval(() => {
      if (this.hasReceivedHeartbeat && Date.now() - this._lastHeartbeatAt > 1500 && this._reconnectTimerId === undefined) {
        this.connectionLost = true;
        this._teardownPort();
        this._scheduleReconnect();
      }
    }, 1000);
  }

  override disconnectedCallback(): void {
    clearInterval(this._stalenessIntervalId);
    clearTimeout(this._reconnectTimerId);
    this._reconnectTimerId = undefined;
    // Disconnect background connection BEFORE Lit tears down the component tree
    // This prevents race conditions where messages arrive during teardown
    this._teardownPort();
    super.disconnectedCallback();
  }

  connectToExtension = () => {
    this.backgroundConnection = browser.runtime.connect({
      name: 'panel'
    });
    this.backgroundConnection.onMessage.addListener(this.backgroundMessageDispatch);
    this.backgroundConnection.onDisconnect.addListener(this._handleDisconnect);

    // Tell the background which tab this panel inspects so the heartbeat
    // polls the right tab instead of whichever tab is focused
    this.backgroundConnection.postMessage({
      name: 'ex-debug:hello',
      tabId: browser.devtools.inspectedWindow.tabId
    });
    return this.backgroundConnection;
  };

  /**
   * Removes port listeners and disconnects without triggering a reconnect.
   */
  private _teardownPort() {
    if (this.backgroundConnection) {
      this.backgroundConnection.onMessage.removeListener(this.backgroundMessageDispatch);
      this.backgroundConnection.onDisconnect.removeListener(this._handleDisconnect);
      try {
        this.backgroundConnection.disconnect();
      } catch {
        // port already dead
      }
    }
  }

  /**
   * Fired when the background service worker dies (extension reload, crash,
   * idle reclaim). Flags the connection as lost and starts reconnecting.
   */
  private _handleDisconnect = () => {
    this.connectionLost = true;
    this._scheduleReconnect();
  };

  /**
   * Reconnects to the background with backoff; the next heartbeat clears the
   * connection-lost state and resets the backoff.
   */
  private _scheduleReconnect() {
    if (this._reconnectTimerId !== undefined || !this.isConnected) {
      return;
    }
    this._reconnectTimerId = setTimeout(() => {
      this._reconnectTimerId = undefined;
      this._reconnectDelayMs = Math.min(this._reconnectDelayMs * 2, 5000);
      try {
        this.connectToExtension();
      } catch {
        // extension context invalidated or background unavailable; keep trying
        this._scheduleReconnect();
      }
    }, this._reconnectDelayMs);
  }

  /**
   * Posts a message to the background, flagging a lost connection instead of
   * throwing out of the calling event handler when the port is dead.
   */
  private _post(message: object) {
    try {
      this.backgroundConnection.postMessage(message);
    } catch {
      this._handleDisconnect();
    }
  }

  backgroundMessageDispatch = (message: EventDispatchEvents) => {
    if (!this.isConnected) {
      return;
    }
    try {
      this._handleMessage(message);
    } catch (e) {
      if (this.isConnected) {
        console.info('Error handling message:', e);
      }
    }
  };

  private _handleMessage(message: EventDispatchEvents) {
    switch (message.name) {
      case 'ex-debug:init': {
        this._post({
          name: 'ex-debug:command',
          tabId: browser.devtools.inspectedWindow.tabId,
          dispatch: 'ex-debug:update-debug',
          debug: {
            ...settingsStore.getAll(),
            ...(this._toggleDebugUserSet ? { toggleDebug: this.toggleDebug } : {})
          }
        });
        if (this._hasInitialized) {
          if (this.selectedFrameId !== null) {
            this._post({
              name: 'ex-debug:command',
              tabId: browser.devtools.inspectedWindow.tabId,
              dispatch: 'ex-debug:select-frame',
              frameId: this.selectedFrameId
            });
          }
          this._syncMaterialsActive();
          this._syncInspectEntity();
          if (this.pickerArmed) {
            this._syncPicker();
          }
        }
        this._hasInitialized = true;
        break;
      }
      case 'ex-debug:heartbeat': {
        this._lastHeartbeatAt = Date.now();
        this.hasReceivedHeartbeat = true;
        this.connectionLost = false;
        this._reconnectDelayMs = 500;
        this.instances = message.instances;

        if (message.selectedFrameId !== this.selectedFrameId) {
          this.selectedFrameId = message.selectedFrameId;
          this._resetInstanceState();
        }

        if (message.data == null) {
          // no instance selected (or a transient miss) — keep the last state
          break;
        }

        const data = JSON.parse(message.data);
        const { version, isDebug, config, screen, camera, currentScene, scenes, pointer, entities, stats, physics, materials } = data;

        // Adopt the game's actual debug state on the first heartbeat that
        // carries data, so reopening devtools doesn't reset a previously-
        // enabled overlay. Once the user explicitly toggles, stop adopting.
        if (!this._toggleDebugUserSet) {
          this.toggleDebug = !!isDebug;
        }

        if (materials) {
          this.materials = materials;
        }

        if (data.inspectedEntity !== undefined) {
          this.inspectedEntity = data.inspectedEntity;
          if (data.inspectedEntity && data.inspectedEntity.graphicsKey !== this._fetchedGraphicsKey) {
            this._fetchedGraphicsKey = data.inspectedEntity.graphicsKey;
            this._requestEntityGraphics(data.inspectedEntity.id);
          }
        }

        if (data.picker !== undefined && this.pickerArmed) {
          const picker: PickerState = data.picker;
          if (!picker.active) {
            if (Date.now() - this._pickerArmedAt > 1000) {
              this.pickerArmed = false;
              this._syncPicker();
            }
          } else if (picker.pickSeq > this._lastPickSeq && picker.pickedId !== null) {
            this._lastPickSeq = picker.pickSeq;
            // single-pick: disarm, tear down the page state, open the inspector
            this.pickerArmed = false;
            this._syncPicker();
            this._inspectEntityById(picker.pickedId);
          }
        }

        this.config = config;
        this.screen = screen;
        this.camera = camera;

        this.engine = {
          version: version,
          currentScene: currentScene,
          scenes: scenes,
          entities: entities,
          pointer: pointer
        };

        const currentPointer = this.engine.pointer;

        if (currentPointer?.worldPos && currentPointer?.screenPos && currentPointer?.pagePos) {
          this.worldPos = `(${currentPointer.worldPos._x.toFixed(2)},${currentPointer.worldPos._y.toFixed(2)})`;
          this.screenPos = `(${currentPointer.screenPos._x.toFixed(2)},${currentPointer.screenPos._y.toFixed(2)})`;
          this.pagePos = `(${currentPointer.pagePos._x.toFixed(2)},${currentPointer.pagePos._y.toFixed(2)})`;
        }

        const v = this.engine.version.split('.');
        const versionRank = (+v[0] || 0) * 1e6 + (+v[1] || 0) * 1e3 + (+v[2] || 0);
        this.isV31OrLater = versionRank >= 31e3;
        const wasV32OrLater = this.isV32OrLater;
        this.isV32OrLater = versionRank >= 32e3;
        if (this.isV32OrLater !== wasV32OrLater) {
          this._syncMaterialsActive();
        }
        this.isV33OrLater = versionRank >= 33e3;

        try {
          const fps = stats.currFrame._fps;
          const elapsedMs = stats.currFrame._delta ?? stats.currFrame._elapsedMs;

          this.stats = {
            fps,
            delta: elapsedMs,
            frameBudget: elapsedMs - stats.currFrame._durationStats.total,
            frameTime: stats.currFrame._durationStats.total,
            updateTime: stats.currFrame._durationStats.update,
            systemDuration: this.isV31OrLater ? stats.currFrame.systemDuration : {},
            drawTime: stats.currFrame._durationStats.draw,
            drawCalls: stats.currFrame._graphicsStats.drawCalls,
            numActors: stats.currFrame._actorStats.total,
            rendererSwaps: this.isV31OrLater ? stats.currFrame._graphicsStats.rendererSwaps : 'Upgrade to v0.32+ to see'
          };

          this.fpsGraph?.draw(fps);

          this.frameTimeGraph?.draw(
            stats.currFrame._durationStats.total,
            stats.currFrame._durationStats.update,
            stats.currFrame._durationStats.draw
          );

          if (this.isV31OrLater) {
            this.systemTimeGraph?.draw(this.stats.systemDuration);
            this.systemStatsList?.updateStats(this.isV31OrLater ? stats.currFrame.systemDuration : {});
          }
        } catch (e) {
          console.info('Error reading engine stats:', e);
        }

        try {
          this.physics = {
            enabled: physics.enabled,
            maxFps: physics.maxFps,
            fixedUpdateFps: physics.fixedUpdateFps,
            fixedUpdateTimestep: physics.fixedUpdateTimestep,
            gravity: { ...physics.gravity },
            config: physics.config
          };
        } catch (e) {
          console.info('Error reading physics settings:', e);
        }
        break;
      }
      case 'ex-debug:material-detail': {
        if (message.data) {
          const detail: MaterialDetail | null = JSON.parse(message.data);
          if (detail) {
            this.materialDetails = { ...this.materialDetails, [detail.key]: detail };
          }
        }
        break;
      }
      case 'ex-debug:entity-graphics': {
        if (message.data) {
          const detail: EntityGraphicsDetail | null = JSON.parse(message.data);
          // ignore stale replies after navigating to a different entity
          if (detail && detail.entityId === this.inspectedEntityId) {
            this.entityGraphics = detail;
          }
        }
        break;
      }
    }
  }

  /**
   * Clears state derived from a specific Excalibur instance when the selected
   * frame changes, so data from the previous instance doesn't linger.
   */
  private _resetInstanceState() {
    this.engine = {
      version: '???',
      currentScene: 'root',
      scenes: [],
      entities: [],
      pointer: null
    };
    this.stats = {
      fps: 0,
      delta: 0,
      frameTime: 0,
      updateTime: 0,
      drawTime: 0,
      frameBudget: 0,
      drawCalls: 0,
      numActors: 0,
      rendererSwaps: 0,
      systemDuration: {}
    };
    this.systemTimeGraph?.reset();
    this.systemStatsList?.reset();
    this.materials = { source: 'scan', list: [] };
    this.materialDetails = {};
    this.worldPos = '???';
    this.screenPos = '???';
    this.pagePos = '???';
    if (this.inspectedEntityId !== null) {
      this.inspectedEntityId = null;
      this.inspectedEntity = null;
      this.entityGraphics = null;
      this._fetchedGraphicsKey = null;
      this._syncInspectEntity();
    }
    this.pickerArmed = false;
  }

  selectFrame(evt: SlChangeEvent) {
    const frameId = +String((evt.target as SlSelect).value);
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:select-frame',
      frameId
    });
  }

  /**
   * Shortens a frame url to hostname + pathname for dropdown labels.
   */
  private _shortUrl(url: string) {
    try {
      const parsed = new URL(url);
      return `${parsed.hostname}${parsed.pathname}`;
    } catch {
      return url;
    }
  }

  /**
   * Builds a human-readable label for an Excalibur instance in the dropdown.
   */
  private _instanceLabel(instance: ExInstance) {
    const location =
      instance.frameId === 0 ? `Top frame — ${instance.title || this._shortUrl(instance.url)}` : this._shortUrl(instance.url);
    return `${location} (v${instance.version})`;
  }

  handleTabShow(evt: CustomEvent<{ name: string }>) {
    this._currentTabName = evt.detail.name;
    this._syncMaterialsActive();
  }

  private _syncMaterialsActive() {
    const active = this._currentTabName === 'materials' && this.isV32OrLater;
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:materials-active',
      active
    });
  }

  materialSelected(evt: CustomEvent<MaterialSelected>) {
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:get-material-detail',
      materialId: evt.detail.materialId,
      materialName: evt.detail.materialName
    });
  }

  updateMaterialUniform(evt: CustomEvent<UniformChange>) {
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:update-material-uniform',
      update: evt.detail
    });
  }

  updatePhysicsSetting(evt: CustomEvent<Physics>) {
    const settings = evt.detail;

    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:update-physics',
      physics: settings
    });
  }

  updateDebugSetting(evt: CustomEvent<Settings>) {
    const settings = evt.detail;

    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:update-debug',
      debug: settings
    });
  }

  toggleDebugDraw() {
    this.toggleDebug = !this.toggleDebug;
    this._toggleDebugUserSet = true;
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:update-debug',
      debug: { ...settingsStore.getAll(), toggleDebug: this.toggleDebug }
    });
  }

  clockStepMs: number = 16;
  handleStepChange(evt: SlChangeEvent) {
    this.clockStepMs = +(evt.target as SlInput).value;
  }
  toggleTestClock() {
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:toggle-test-clock'
    });
  }

  startClock() {
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:start-clock'
    });
  }

  stopClock() {
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:stop-clock'
    });
  }

  stepClock() {
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:step-clock',
      stepMs: this.clockStepMs
    });
  }

  startProfiler() {
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:start-profiler',
      time: 300
    });
  }

  collectProfile() {
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:collect-profiler'
    });
  }

  killActor(evt: CustomEvent<number>) {
    const id = evt.detail;
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:kill',
      actorId: id
    });
  }

  setColorBlind() {
    const colorBlindRadioGroup = this.shadowRoot?.querySelector('#color-blind') as SlRadioGroup;
    const colorBlindMode = colorBlindRadioGroup?.value ?? 'Normal';
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:color-blind',
      colorBlindMode: colorBlindMode
    });
  }

  identifyActor(evt: CustomEvent<number>) {
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:identify-actor',
      actorId: evt.detail
    });
  }

  /**
   * Tells the background which entity (if any) to deep-serialize each
   * heartbeat; posting null clears the flag when the inspector closes.
   */
  private _syncInspectEntity() {
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:inspect-entity',
      entityId: this.inspectedEntityId
    });
  }

  /**
   * Fetches the heavy graphics detail (thumbnails + registry pool) for the
   * inspected entity on demand.
   */
  private _requestEntityGraphics(entityId: number) {
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:get-entity-graphics',
      entityId
    });
  }

  /**
   * Opens the inspector dialog for an entity. The next heartbeat delivers
   * the serialized entity and triggers the graphics fetch via graphicsKey.
   */
  private _inspectEntityById(id: number) {
    this.inspectedEntityId = id;
    this.inspectedEntity = null;
    this.entityGraphics = null;
    this._fetchedGraphicsKey = null;
    this._syncInspectEntity();
  }

  /**
   * Opens the inspector dialog for an entity (from the entity list button or
   * parent/child navigation inside the dialog).
   */
  inspectEntity(evt: CustomEvent<number>) {
    this._inspectEntityById(evt.detail);
  }

  /**
   * Posts the picker command matching the current armed state: start installs
   * the page-side picker (the background arms its flag once the install
   * resolves), stop tears it down and clears the flag.
   */
  private _syncPicker() {
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: this.pickerArmed ? 'ex-debug:picker-start' : 'ex-debug:picker-stop'
    });
  }

  /**
   * Toggles the page-side entity picker from the entity list button. A pick
   * or a page-side Escape also disarms via the heartbeat's picker state.
   */
  togglePicker() {
    this.pickerArmed = !this.pickerArmed;
    if (this.pickerArmed) {
      this._pickerArmedAt = Date.now();
      this._lastPickSeq = 0;
    }
    this._syncPicker();
  }

  /**
   * Closes the inspector dialog and stops per-heartbeat entity serialization.
   */
  inspectorClosed() {
    this.inspectedEntityId = null;
    this.inspectedEntity = null;
    this.entityGraphics = null;
    this._fetchedGraphicsKey = null;
    this._syncInspectEntity();
  }

  updateEntityProperty(evt: CustomEvent<EntityPropertyUpdate>) {
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:update-entity-property',
      update: evt.detail
    });
  }

  useEntityGraphic(evt: CustomEvent<{ entityId: number; graphicName: string; source: 'local' | 'registry' }>) {
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:use-entity-graphic',
      entityId: evt.detail.entityId,
      graphicName: evt.detail.graphicName,
      source: evt.detail.source
    });
  }

  goToScene(evt: CustomEvent<string>) {
    const scene = evt.detail;
    this._post({
      name: 'ex-debug:command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'ex-debug:goto-scene',
      sceneName: scene
    });
  }

  override render() {
    return html`
      ${this.connectionLost
        ? html`<no-excalibur-overlay
            .message=${'Connection to the extension was lost — reconnecting… (reopen DevTools if this persists)'}
          ></no-excalibur-overlay>`
        : this.instances.length === 0
          ? html`<no-excalibur-overlay
              .message=${this.hasReceivedHeartbeat ? 'No Excalibur detected on the page' : 'Connecting to page…'}
            ></no-excalibur-overlay>`
          : ''}
      <h1><img src=${logoImg} alt="Excalibur Dev Tools" />Dev Tools</h1>
      <div class="version">
        <span>Engine Version: <span id="excalibur-version">${this.engine.version}</span></span>
        ${this.instances.length > 1
          ? html`<sl-select size="small" .value=${String(this.selectedFrameId ?? '')} @sl-change=${this.selectFrame}>
              ${this.instances.map(
                (instance) => html`<sl-option value=${String(instance.frameId)}>${this._instanceLabel(instance)}</sl-option>`
              )}
            </sl-select>`
          : ''}
      </div>
      <entity-inspector
        .open=${this.inspectedEntityId !== null}
        .entity=${this.inspectedEntity}
        .graphics=${this.entityGraphics}
        @inspect-entity=${this.inspectEntity}
        @entity-property-change=${this.updateEntityProperty}
        @use-graphic=${this.useEntityGraphic}
        @inspector-closed=${this.inspectorClosed}
      ></entity-inspector>

      <sl-tab-group @sl-tab-show=${this.handleTabShow}>
        <sl-tab slot="nav" panel="inspector">Inspector</sl-tab>
        <sl-tab slot="nav" panel="screen-camera">Screen & Camera</sl-tab>
        <sl-tab slot="nav" panel="perf">Performance</sl-tab>
        <sl-tab slot="nav" panel="debugdraw">Debug Draw</sl-tab>
        <sl-tab slot="nav" panel="physics">Physics</sl-tab>
        <sl-tab slot="nav" panel="materials">Materials</sl-tab>

        <sl-tab-panel name="inspector">
          <div class="row">
            <div class="widget">
              <h2>Clock</h2>
              <div class="section">
                <div>
                  <sl-button @click=${this.toggleTestClock}>Toggle Test Clock</sl-button>
                </div>

                <div class="form-row">
                  <sl-input
                    id="clock-step-ms"
                    type="number"
                    .value=${this.clockStepMs.toString()}
                    step="1"
                    min="1"
                    max="100"
                    @sl-change=${this.handleStepChange}
                  ></sl-input>
                  <label for="clock-step-ms">Clock Step(ms)</label>
                </div>
                <div>
                  <sl-button @click=${this.stopClock}>Stop</sl-button>
                  <sl-button @click=${this.startClock}>Start</sl-button>
                  <sl-button @click=${this.stepClock}>Step</sl-button>
                </div>
                <div class="form-row"></div>
              </div>
            </div>
            <div class="widget">
              <h2>Input</h2>
              <div class="section">
                <h3>Pointer</h3>
                <div>World Pos: <span id="world-pos">${this.worldPos}</span></div>
                <div>Screen Pos: <span id="screen-pos">${this.screenPos}</span></div>
                <div>Page Pos: <span id="page-pos">${this.pagePos}</span></div>
              </div>
            </div>

            <div class="widget">
              <h2>Accessibility</h2>
              <div class="section">
                <h3>Simulate Color Blindness</h3>
                <sl-radio-group
                  id="color-blind"
                  @sl-change=${this.setColorBlind}
                  label="Select an option"
                  name="color-blindness"
                  value="Normal"
                >
                  <sl-radio value="Normal">Fully Sighted</sl-radio>
                  <sl-radio value="Protanope">Protanope</sl-radio>
                  <sl-radio value="Deuteranope">Deuteranope</sl-radio>
                  <sl-radio value="Tritanope">Tritanope</sl-radio>
                  <!-- <sl-radio value="Grayscale">Grayscale</sl-radio> -->
                  <!-- <sl-radio value="Contrast">High Contast</sl-radio> -->
                </sl-radio-group>
              </div>
            </div>
          </div>
          <div class="row">
            <div class="widget">
              <h2>Entities</h2>
              <entity-list
                .entities=${this.engine.entities}
                .pickerArmed=${this.pickerArmed}
                @kill-actor=${this.killActor}
                @identify-actor=${this.identifyActor}
                @inspect-entity=${this.inspectEntity}
                @toggle-picker=${this.togglePicker}
              ></entity-list>
            </div>
            <div class="widget">
              <h2>Scene</h2>
              <div class="section">
                <div>Current Scene: <span id="current-scene-name">${this.engine.currentScene}</span></div>
                <div>
                  Available Scenes:
                  <scene-list @goto-scene=${this.goToScene} .scenes=${this.engine.scenes}></scene-list>
                </div>
              </div>
            </div>
          </div>
        </sl-tab-panel>

        <sl-tab-panel name="screen-camera">
          <screen-camera
            .config=${this.config}
            .screen=${this.screen}
            .camera=${this.camera}
            .isV33OrLater=${this.isV33OrLater}
            @debug-settings-change=${this.updateDebugSetting}
          ></screen-camera>
        </sl-tab-panel>
        <sl-tab-panel name="perf">
          <div class="row">
            <div class="widget">
              <h2>Stats</h2>
              <div class="row">
                <div class="widget">
                  <fps-graph class="chart"></fps-graph>
                </div>
                <div class="widget">
                  <frame-time-graph class="chart"></frame-time-graph>
                </div>
                <stats-list .stats=${this.stats}></stats-list>
              </div>
              ${this.isV31OrLater
                ? html`
                <div class="row">
                  <div class="widget">
                    <system-time-graph class="chart"></system-time-graph>
                  </div>
                </div>

                <div class="row">
                  <div class="widget" style="width:100%">
                    <system-stats-list></system-stats-list>
                  </div
                </div>
                `
                : ''}
            </div>
          </div>

          <!-- <div class="row">
                    <div class="widget">
                        <h2>Profiling</h2>
                        <div class="section" style="width: 1000px;">
                            <div>Requires a dev build of excalibur to be used (v0.28.3+)</div>
                            <div>Read more <a href="https://excaliburjs.com/docs/" target="_blank" rel="noopener">here</a>
                            </div>
                            <div>
                                <sl-button @click=${this.startProfiler}>Start Profile</sl-button>
                                <sl-button @click=${this.collectProfile}>Collect</sl-button>
                            </div>
                            <flame-chart></flame-chart>
                        </div>
                    </div>
                </div> -->
        </sl-tab-panel>
        <sl-tab-panel name="debugdraw">
          <debug-settings
            @toggle-debug-draw=${this.toggleDebugDraw}
            @debug-settings-change=${this.updateDebugSetting}
            .settings=${this.settings}
          >
          </debug-settings>
        </sl-tab-panel>
        <sl-tab-panel name="physics">
          <physics-settings @physics-settings-change=${this.updatePhysicsSetting} .settings=${this.physics}> </physics-settings>
        </sl-tab-panel>
        <sl-tab-panel name="materials">
          <materials-panel
            @material-selected=${this.materialSelected}
            @uniform-change=${this.updateMaterialUniform}
            .materials=${this.materials}
            .details=${this.materialDetails}
            .unsupported=${!this.isV32OrLater}
          >
          </materials-panel>
        </sl-tab-panel>
      </sl-tab-group>
    `;
  }
}
