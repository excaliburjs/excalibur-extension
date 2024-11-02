import { LitElement, html, css, PropertyValueMap } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js'
import logoImg from '../../res/logo-white@2x.png';

import './debug-settings';
import './entity-list';
import './fps-graph';
import './frame-time-graph';
import './flame-chart';
import './stats-list';
import './scene-list';
import { colors } from '../colors';
import { common } from '../common';
import { Debug, DefaultSettings, Settings } from './debug-settings';
import { FpsGraph } from './fps-graph';
import { FrameTimeGraph } from './frame-time-graph';
import { Stats } from './stats-list';
import { FlameChart } from './flame-chart';
import { SlChangeEvent, SlInput } from '@shoelace-style/shoelace';


declare namespace browser {
    export import runtime = chrome.runtime;
    export import tabs = chrome.tabs;
    export import devtools = chrome.devtools;
}

if (typeof browser == "undefined") {
    // Chrome does not support the browser namespace yet.
    (globalThis as any).browser = chrome;
}

interface Engine {
    version: string;
    currentScene: string;
    debug: Debug;
    scenes: any[];
    entities: any[];
    pointer: any;
}


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
        `
    ];
    @query('fps-graph') fpsGraph!: FpsGraph;
    @query('frame-time-graph') frameTimeGraph!: FrameTimeGraph;
    @query('flame-chart') flameChart!: FlameChart;

    @state({ hasChanged: (newValue, oldValue) => JSON.stringify(newValue) !== JSON.stringify(oldValue) })
    engine: Engine = {
        version: '???',
        currentScene: 'root',
        debug: {} as Debug,
        scenes: [],
        entities: [],
        pointer: null
    }

    @state({ hasChanged: (newValue, oldValue) => JSON.stringify(newValue) !== JSON.stringify(oldValue) })
    settings: Settings | null = DefaultSettings;

    @state({ hasChanged: (newValue, oldValue) => JSON.stringify(newValue) !== JSON.stringify(oldValue) })
    stats: Stats = {
        fps: 0,
        delta: 0,
        frameTime: 0,
        updateTime: 0,
        drawTime: 0,
        frameBudget: 0,
        drawCalls: 0,
        numActors: 0
    }

    @state()
    worldPos: string = '???';
    @state()
    screenPos: string = '???';
    @state()
    pagePos: string = '???';

    backgroundConnection!: browser.runtime.Port;

    override firstUpdated(): void {        
        this.connectToExtension()

        if (this.backgroundConnection) {
            this.backgroundConnection?.onMessage.addListener(this.backgroundMessageDispatch);

            // Handles when user navigates and re-installs the content script telemetry
            // In firefox only background scripts can access browser.tabs
            browser?.tabs?.onUpdated.addListener((tabId, changeInfo) => {
                if (changeInfo.status === 'complete' && tabId === browser.devtools.inspectedWindow.tabId) {
                    this.installTelemetry()
                }
            })

            this.installTelemetry()

        } else {
            console.error('Could not connect to background page?');
        }

        // reload panel when tab/service-worker was reloaded
        document.addEventListener('visibilitychange', (ev) => {            
            if (document.visibilityState === 'visible') {        
                try {        
                    // this will throw an error if the extension context was lost... not sure
                    // if there's a better way to do this
                    this.connectToExtension()
                } catch (err) {
                    // i couldn't figure out a way to properly reconnect, so just reload the page
                    if (err instanceof Error && err.message.match(/Extension context invalidated/)) {                                
                        window.location.reload()
                    } else {
                        throw err
                    }
                    throw err
                }
            }
        })
    }

    connectToExtension = () => {
        this.backgroundConnection = browser.runtime.connect({
            name: 'panel',
        })
        return this.backgroundConnection
    }

    installTelemetry = () => {
        this.backgroundConnection?.postMessage({
            name: 'init',
            tabId: browser.devtools.inspectedWindow.tabId
        });

        this.backgroundConnection?.postMessage({
            name: 'command',
            tabId: browser.devtools.inspectedWindow.tabId,
            dispatch: 'install-heartbeat'
        })
    }
    backgroundMessageDispatch = (message: { name: string, data: any }) => {                
        switch (message.name) {
            case 'scenes': {
                this.engine.scenes = message.data;
                break;
            }
            case 'current-scene': {
                this.engine.currentScene = message.data;
                // currentScene$!.innerText = engine.currentScene;
                break;
            }
            case 'echo': {
                break;
            }
            case 'heartbeat':
            case 'install': {                
                const debug = JSON.parse(message.data.debug) as Debug;
                this.engine = message.data;
                this.engine.debug = debug;
                this.settings = {
                    showNames: debug.entity.showName,
                    showIds: debug.entity.showId,
                    showPos: debug.transform.showPosition,
                    showPosLabel: debug.transform.showPositionLabel,
                    posColor: debug.transform.positionColor,
                    showGraphicsBounds: debug.graphics.showBounds,
                    graphicsBoundsColor: debug.graphics.boundsColor,
                    showColliderBounds: debug.collider.showBounds,
                    colliderBoundsColor: debug.collider.boundsColor,
                    showGeometryBounds: debug.collider.showGeometry,
                    geometryBoundsColor: debug.collider.geometryColor
                }

                const fps = debug.stats.currFrame._fps;
                const elapsedMs = (debug.stats.currFrame._delta ?? debug.stats.currFrame._elapsedMs);
                this.stats = {
                    fps,
                    delta: elapsedMs,
                    frameBudget: elapsedMs - debug.stats.currFrame._durationStats.total,
                    frameTime: debug.stats.currFrame._durationStats.total,
                    updateTime: debug.stats.currFrame._durationStats.update,
                    drawTime: debug.stats.currFrame._durationStats.draw,
                    drawCalls: debug.stats.currFrame._graphicsStats.drawCalls,
                    numActors: debug.stats.currFrame._actorStats.total
                }

                this.fpsGraph.draw(fps);
                this.frameTimeGraph.draw(
                    debug.stats.currFrame._durationStats.total,
                    debug.stats.currFrame._durationStats.update,
                    debug.stats.currFrame._durationStats.draw,
                    elapsedMs);

                const pointer = this.engine.pointer;

                if (pointer?.worldPos && pointer?.screenPos && pointer?.pagePos) {
                    this.worldPos = `(${pointer.worldPos._x.toFixed(2)},${pointer.worldPos._y.toFixed(2)})`
                    this.screenPos = `(${pointer.screenPos._x.toFixed(2)},${pointer.screenPos._y.toFixed(2)})`
                    this.pagePos = `(${pointer.pagePos._x.toFixed(2)},${pointer.pagePos._y.toFixed(2)})`
                }
                break;
            }
            case 'collect-profiler': {
                this.flameChart.updateFlame(message.data);
                break;
            }
            default: {
                // console.warn('Unknown message', message);
            }
        }
    }



    updateDebugSetting(evt: any) {
        const settings = (evt as any).detail as Settings;
        const engine = this.engine;
        const newDebug: Debug = {
            ...engine.debug,
            entity: {
                ...engine.debug.entity,
                showId: settings.showIds,
                showName: settings.showNames,
            },
            transform: {
                ...engine.debug.transform,
                showPosition: settings.showPos,
                showPositionLabel: settings.showPosLabel,
                positionColor: settings.posColor,
            },
            graphics: {
                ...engine.debug.graphics,
                showBounds: settings.showGraphicsBounds,
                boundsColor: settings.graphicsBoundsColor
            },
            collider: {
                ...engine.debug.collider,
                showBounds: settings.showColliderBounds,
                boundsColor: settings.colliderBoundsColor,
                showGeometry: settings.showGeometryBounds,
                geometryColor: settings.geometryBoundsColor
            }
        }
        this.backgroundConnection.postMessage({
            name: 'command',
            tabId: browser.devtools.inspectedWindow.tabId,
            dispatch: 'update-debug',
            debug: newDebug
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
        })
    }

    stopClock() {
        this.backgroundConnection.postMessage({
            name: 'command',
            tabId: browser.devtools.inspectedWindow.tabId,
            dispatch: 'stop-clock'
        })
    }

    stepClock() {
        this.backgroundConnection.postMessage({
            name: 'command',
            tabId: browser.devtools.inspectedWindow.tabId,
            dispatch: 'step-clock',
            stepMs: this.clockStepMs
        })

    }

    startProfiler() {
        this.backgroundConnection.postMessage({
            name: 'command',
            tabId: browser.devtools.inspectedWindow.tabId,
            dispatch: 'start-profiler',
            time: 300,
        });
    }

    collectProfile() {
        this.backgroundConnection.postMessage({
            name: 'command',
            tabId: browser.devtools.inspectedWindow.tabId,
            dispatch: 'collect-profiler'
        })
    }

    killActor(evt: any) {
        const id = evt.detail as number;
        this.backgroundConnection.postMessage({
            name: 'command',
            tabId: browser.devtools.inspectedWindow.tabId,
            dispatch: 'kill',
            actorId: id
        })
    }

    goToScene(evt: any) {
        const scene = evt.detail as string;
        this.backgroundConnection.postMessage({
            name: 'command',
            tabId: browser.devtools.inspectedWindow.tabId,
            dispatch: 'goto',
            scene
        })
    }
 
    override render() {
        return html`
        <h1><img src=${logoImg} alt="Excalibur Dev Tools">Dev Tools</h1>
        <div class="version">Engine Version: <span id="excalibur-version">${this.engine.version}</span></div>
        <entity-inspector></entity-inspector>

        <sl-tab-group>
            <sl-tab slot="nav" panel="inspector">Inspector</sl-tab>
            <sl-tab slot="nav" panel="perf">Performance</sl-tab>
            <sl-tab slot="nav" panel="debugdraw">Debug Draw</sl-tab>

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
                                        <sl-input id="clock-step-ms" type="number" .value=${this.clockStepMs.toString()} step="1" , min="1" , max="100" @sl-change=${this.handleStepChange}></sl-input>
                                        <label for="clock-step-ms">Clock Step(ms)</label>
                                    </div>
                                    <div>
                                        <sl-button @click=${this.stopClock}>Stop</sl-button>
                                        <sl-button @click=${this.startClock}>Start</sl-button>
                                        <sl-button @click=${this.stepClock}>Step</sl-button>
                                    </div>
                                    <div class="form-row">

                                    </div>
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
                        </div>
                        <div class="row">
                            <div class="widget">
                                <h2>Entities</h2>
                                <entity-list .entities=${this.engine.entities} @kill-actor=${this.killActor}></entity-list>
                            </div>
                            <div class="widget">
                                <h2>Scene</h2>
                                <div class="section">
                                    <div>Current Scene: <span id="current-scene-name">${this.engine.currentScene}</span></div>
                                    <div>Available Scenes:
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
                <div class="row">
                    <div class="widget">
                        <h2>Debug Draw Settings</h2>
                        <debug-settings 
                            @toggle-debug-draw=${this.toggleDebugDraw}
                            @debug-settings-change=${this.updateDebugSetting}
                            .settings=${this.settings}>
                        </debug-settings>
                    </div>
                </div>

            </sl-tab-panel>
        </sl-tab-group>
        
        `;
    }
}
