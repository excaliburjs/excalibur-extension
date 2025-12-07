import { css, html, LitElement } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import logoImg from '../../res/logo-white@2x.png';

import './debug-settings';
import './entity-list';
import './fps-graph';
import './frame-time-graph';
import './flame-chart';
import './stats-list';
import './scene-list';
import './physics-settings';
import { colors } from '../colors';
import { common } from '../common';
import { DefaultSettings, Settings } from './debug-settings';
import { FpsGraph } from './fps-graph';
import { FrameTimeGraph } from './frame-time-graph';
import { Stats } from './stats-list';
import { FlameChart } from './flame-chart';
import { SlChangeEvent, SlInput, SlRadioGroup } from '@shoelace-style/shoelace';
import { Entity } from './entity-list';
import { DefaultPhysicsSettings, Physics } from './physics-settings';

globalThis.browser = globalThis.browser || chrome;

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

interface InitEvent {
  name: 'init';
  data: {
    settings: Settings;
  };
}

interface HeartbeatEvent {
  name: 'heartbeat';
  data: string;
}

type EventDispatchEvents = InitEvent | HeartbeatEvent;

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
      }
      sl-radio {
        margin-bottom: 5px;
      }


    `
  ];
  @query('fps-graph')
  fpsGraph!: FpsGraph;
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

  @state({
    hasChanged: (newValue, oldValue) => JSON.stringify(newValue) !== JSON.stringify(oldValue)
  })
  settings: Settings | null = DefaultSettings;

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
  };

  @state({
    hasChanged: (newValue, oldValue) => JSON.stringify(newValue) !== JSON.stringify(oldValue)
  })
  physics: Physics = DefaultPhysicsSettings;

  @state()
  worldPos: string = '???';
  @state()
  screenPos: string = '???';
  @state()
  pagePos: string = '???';

  backgroundConnection!: browser.runtime.Port;

  override firstUpdated(): void {
    this.connectToExtension();

    if (this.backgroundConnection) {
      this.backgroundConnection.onMessage.addListener(this.backgroundMessageDispatch);
    } else {
      throw new Error('Could not connect to background page?');
    }
  }

  connectToExtension = () => {
    this.backgroundConnection = browser.runtime.connect({
      name: 'panel'
    });
    return this.backgroundConnection;
  };

  backgroundMessageDispatch = (message: EventDispatchEvents) => {
    switch (message.name) {
      case 'init': {
        const { settings } = message.data;
        this.settings = { ...settings };
        break;
      }
      case 'heartbeat': {
        const { version, currentScene, scenes, pointer, entities, stats, physics } = JSON.parse(message.data);
        this.engine = {
          version: version,
          currentScene: currentScene,
          scenes: scenes,
          entities: entities,
          pointer: pointer,
        };

        const currentPointer = this.engine.pointer;

        if (currentPointer?.worldPos && currentPointer?.screenPos && currentPointer?.pagePos) {
          this.worldPos = `(${currentPointer.worldPos._x.toFixed(2)},${currentPointer.worldPos._y.toFixed(2)})`;
          this.screenPos = `(${currentPointer.screenPos._x.toFixed(2)},${currentPointer.screenPos._y.toFixed(2)})`;
          this.pagePos = `(${currentPointer.pagePos._x.toFixed(2)},${currentPointer.pagePos._y.toFixed(2)})`;
        }

        const fps = stats.currFrame._fps;
        const elapsedMs = stats.currFrame._delta ?? stats.currFrame._elapsedMs;
        this.stats = {
          fps,
          delta: elapsedMs,
          frameBudget: elapsedMs - stats.currFrame._durationStats.total,
          frameTime: stats.currFrame._durationStats.total,
          updateTime: stats.currFrame._durationStats.update,
          drawTime: stats.currFrame._durationStats.draw,
          drawCalls: stats.currFrame._graphicsStats.drawCalls,
          numActors: stats.currFrame._actorStats.total,
          rendererSwaps: stats.currFrame._graphicsStats.rendererSwaps
        };

        this.fpsGraph.draw(fps);
        this.frameTimeGraph.draw(
          stats.currFrame._durationStats.total,
          stats.currFrame._durationStats.update,
          stats.currFrame._durationStats.draw
        );

        this.physics = {
          enabled: physics.enabled,
          maxFps: physics.maxFps,
          fixedUpdateFps: physics.fixedUpdateFps,
          fixedUpdateTimestep: physics.fixedUpdateTimestep,
          gravity: {...physics.gravity},
          solverStrategy: physics.solverStrategy,
        };
        break;
      }
    }
  };

  updatePhysicsSetting(evt: CustomEvent<Physics>) {
    const settings = evt.detail;

    this.backgroundConnection.postMessage({
      name: 'command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'update-physics',
      physics: settings
    });
  }

  updateDebugSetting(evt: CustomEvent<Settings>) {
    const settings = evt.detail;

    this.backgroundConnection.postMessage({
      name: 'command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'update-debug',
      debug: settings
    });
  }

  toggleDebugDraw() {
    this.backgroundConnection.postMessage({
      name: 'command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'toggle-debug'
    });
  }

  // clock
  clockStepMs: number = 16;
  handleStepChange(evt: SlChangeEvent) {
    this.clockStepMs = +(evt.target as SlInput).value;
  }
  toggleTestClock() {
    this.backgroundConnection.postMessage({
      name: 'command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'toggle-test-clock'
    });
  }

  startClock() {
    this.backgroundConnection.postMessage({
      name: 'command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'start-clock'
    });
  }

  stopClock() {
    this.backgroundConnection.postMessage({
      name: 'command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'stop-clock'
    });
  }

  stepClock() {
    this.backgroundConnection.postMessage({
      name: 'command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'step-clock',
      stepMs: this.clockStepMs
    });
  }

  startProfiler() {
    this.backgroundConnection.postMessage({
      name: 'command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'start-profiler',
      time: 300
    });
  }

  collectProfile() {
    this.backgroundConnection.postMessage({
      name: 'command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'collect-profiler'
    });
  }

  killActor(evt: CustomEvent<number>) {
    const id = evt.detail;
    this.backgroundConnection.postMessage({
      name: 'command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'kill',
      actorId: id
    });
  }

  setColorBlind() {
    const colorBlindRadioGroup = this.shadowRoot?.querySelector('#color-blind') as SlRadioGroup;
    const colorBlindMode = (colorBlindRadioGroup?.value) ?? 'Normal';
    this.backgroundConnection.postMessage({
      name: 'command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'color-blind',
      colorBlindMode: colorBlindMode
    });
  }

  identifyActor(evt: CustomEvent<number>) {
    this.backgroundConnection.postMessage({
      name: 'command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'identify-actor',
      actorId: evt.detail,
    });
  }

  goToScene(evt: CustomEvent<string>) {
    const scene = evt.detail;
    this.backgroundConnection.postMessage({
      name: 'command',
      tabId: browser.devtools.inspectedWindow.tabId,
      dispatch: 'goto',
      scene
    });
  }

  override render() {
    return html`
      <h1><img src=${logoImg} alt="Excalibur Dev Tools" />Dev Tools</h1>
      <div class="version">Engine Version: <span id="excalibur-version">${this.engine.version}</span></div>
      <entity-inspector></entity-inspector>

      <sl-tab-group>
        <sl-tab slot="nav" panel="inspector">Inspector</sl-tab>
        <sl-tab slot="nav" panel="screencamera">Screen & Camera</sl-tab>
        <sl-tab slot="nav" panel="input">Input</sl-tab> <!-- Input Handlers, Input Mapping, etc -->
        <sl-tab slot="nav" panel="perf">Performance</sl-tab>
        <sl-tab slot="nav" panel="debugdraw">Debug Draw</sl-tab>
        <sl-tab slot="nav" panel="physics">Physics</sl-tab>

        <sl-tab-panel name="inspector">
          <!-- <sl-split-panel position="75"> -->
          <!-- <div slot="start"> -->

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
                  value="Normal">
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
              <entity-list .entities=${this.engine.entities} @kill-actor=${this.killActor} @identify-actor=${this.identifyActor}></entity-list>
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
          <!-- </div> -->
          <!-- <div slot="end">
                    </div> -->
          <!-- </sl-split-panel> -->
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
          <div class="row">
            <div class="widget">
              <h2>Physics Settings</h2>
              <physics-settings
                @physics-settings-change=${this.updatePhysicsSetting}
                .settings=${this.physics}
              >
              </physics-settings>
            </div>
          </div>
        </sl-tab-panel>
      </sl-tab-group>
    `;
  }
}
