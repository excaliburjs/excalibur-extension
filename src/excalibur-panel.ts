import './components/fps-graph';
import { FpsGraph } from './components/fps-graph';

import './components/frame-time-graph';
import { FrameTimeGraph } from './components/frame-time-graph';

import './components/stats-list';
import { StatsList } from './components/stats-list';

import './components/entity-list';;
import { EntityList } from './components/entity-list';


interface DebugStats {

}

interface ColorBlindFlags {

}

interface Color {
    r: number;
    g: number;
    b: number;
}

interface Debug {
    /**
     * Performance statistics
     */
    stats: DebugStats;
    /**
     * Correct or simulate color blindness using [[ColorBlindnessPostProcessor]].
     * @warning Will reduce FPS.
     */
    colorBlindMode: ColorBlindFlags;
    /**
     * Filter debug context to named entities or entity ids
     */
    filter: {
        useFilter: boolean;
        nameQuery: string;
        ids: number[];
    };
    /**
     * Entity debug settings
     */
    entity: {
        showAll: boolean;
        showId: boolean;
        showName: boolean;
    };
    /**
     * Transform component debug settings
     */
    transform: {
        showAll: boolean;
        showPosition: boolean;
        showPositionLabel: boolean;
        positionColor: Color;
        showZIndex: boolean;
        showScale: boolean;
        scaleColor: Color;
        showRotation: boolean;
        rotationColor: Color;
    };
    /**
     * Graphics component debug settings
     */
    graphics: {
        showAll: boolean;
        showBounds: boolean;
        boundsColor: Color;
    };
    /**
     * Collider component debug settings
     */
    collider: {
        showAll: boolean;
        showBounds: boolean;
        boundsColor: Color;
        showOwner: boolean;
        showGeometry: boolean;
        geometryColor: Color;
    };
    /**
     * Physics simulation debug settings
     */
    physics: {
        showAll: boolean;
        showBroadphaseSpacePartitionDebug: boolean;
        showCollisionNormals: boolean;
        collisionNormalColor: Color;
        showCollisionContacts: boolean;
        collisionContactColor: Color;
    };
    /**
     * Motion component debug settings
     */
    motion: {
        showAll: boolean;
        showVelocity: boolean;
        velocityColor: Color;
        showAcceleration: boolean;
        accelerationColor: Color;
    };
    /**
     * Body component debug settings
     */
    body: {
        showAll: boolean;
        showCollisionGroup: boolean;
        showCollisionType: boolean;
        showSleeping: boolean;
        showMotion: boolean;
        showMass: boolean;
    };
    /**
     * Camera debug settings
     */
    camera: {
        showAll: boolean;
        showFocus: boolean;
        focusColor: Color;
        showZoom: boolean;
    };
}

// Current Engine representation in the extension
interface Engine {
    version: string;
    currentScene: string;
    debug: Debug;
    scenes: any[];
    entities: any[];
    pointer: any;
}

let engine: Engine = {
    version: '???',
    currentScene: 'root',
    debug: {} as Debug,
    scenes: [],
    entities: [],
    pointer: null
}

const backgroundConnection = chrome.runtime.connect({
    name: 'panel'
});

const hexToColor = (hex: string) => {
    hex = hex.substring(1);
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return { r, g, b, a: 1.0 };
}

const colorToHex = (color: Color ) => {
    const r = color.r.toString(16).padStart(2, '0');
    const g = color.g.toString(16).padStart(2, '0');
    const b = color.b.toString(16).padStart(2, '0');
    return `#${r}${g}${b}`
}


const updateDebug = (debug: Debug) => {
    backgroundConnection.postMessage({
        name: 'command',
        tabId: chrome.devtools.inspectedWindow.tabId,
        dispatch: 'update-debug',
        debug
    });
}

const selectActor = (actorId: number) => {
    const newDebug: Debug = { ...engine.debug };
    newDebug.filter.useFilter = true;
    newDebug.filter.ids = [actorId];
    updateDebug(newDebug);
}

const killActor = (actorId: number) => {
    backgroundConnection.postMessage({
        name: 'command',
        tabId: chrome.devtools.inspectedWindow.tabId,
        dispatch: 'kill',
        actorId
    });
}

// version
const excaliburVersion$ = document.getElementById('excalibur-version');

// graphs
const litFpsChart = document.querySelector('fps-graph') as FpsGraph;
const litFrameTimeGraph = document.querySelector('frame-time-graph') as FrameTimeGraph;
const litStatsList = document.querySelector('stats-list') as StatsList;

// clock
const toggleTestClock$ = document.getElementById('toggle-test-clock');
const startClock$ = document.getElementById('start-clock');
const stopClock$ = document.getElementById('stop-clock');
const clockStepMs$ = document.getElementById('clock-step-ms');
const stepClock$ = document.getElementById('step-clock');


// ui components
const toggleDebugButton$ = document.getElementById('toggle-debug');
const currentScene$ = document.getElementById('current-scene-name');
const scenes$ = document.getElementById('scenes');
const debugSettingsRaw$ = document.getElementById('debug-settings-raw');
const entityList$ = document.getElementById('entity-list');

// input 
const worldPos$ = document.getElementById('world-pos');
const screenPos$ = document.getElementById('screen-pos');
const pagePos$ = document.getElementById('page-pos');


// profiler
const chart = flamegraph().width(1000).setColorHue('blue').selfValue(false).inverted(true).minFrameSize(0);
const details = document.getElementById("details");
chart.setDetailsElement(details);
chart.label((data) => {
    return data.data.name + ':' + data.data.value.toString() + '(ms)'
});

const flameCanvas = document.getElementById('flame-canvas');


const startProfiler$ = document.getElementById('start');
const collectProfiler$ = document.getElementById('collect');

// settings
const posColor$ = document.getElementById('show-pos-color');
posColor$!.addEventListener('sl-input', evt => {
    const newDebug = { ...engine.debug };
    newDebug.transform.positionColor = hexToColor(evt.target.value);
    updateDebug(newDebug);
});

const showNames$ = document.getElementById('show-names');
showNames$!.addEventListener('sl-change', function (evt) {
    const newDebug = { ...engine.debug };
    newDebug.entity.showName = !!evt.target.checked;
    updateDebug(newDebug);
});

const showIds$ = document.getElementById('show-ids');
showIds$!.addEventListener('sl-change', function (evt) {
    const newDebug = { ...engine.debug };
    newDebug.entity.showId = !!evt.target.checked;
    updateDebug(newDebug);
});

const showPos$ = document.getElementById('show-pos');
showPos$!.addEventListener('sl-change', function (evt) {
    const newDebug = { ...engine.debug };
    newDebug.transform.showPosition = !!evt.target.checked;
    updateDebug(newDebug);
});

const showPosLabel$ = document.getElementById('show-pos-label');
showPosLabel$!.addEventListener('sl-change', function (evt) {
    const newDebug = { ...engine.debug };
    newDebug.transform.showPositionLabel = !!evt.target.checked;
    updateDebug(newDebug);
});

const showGraphicsBounds$ = document.getElementById('show-graphics-bounds');
showGraphicsBounds$!.addEventListener('sl-change', function (evt) {
    const newDebug = { ...engine.debug };
    newDebug.graphics.showBounds = !!evt.target.checked;
    updateDebug(newDebug);
});

const graphicsBoundsColor$ = document.getElementById('graphics-bounds-colors');
graphicsBoundsColor$!.addEventListener('sl-input', evt => {
    const newDebug = { ...engine.debug };
    newDebug.graphics.boundsColor = hexToColor(evt.target.value);
    updateDebug(newDebug);
});

const showColliderBounds$ = document.getElementById('show-collider-bounds');
showColliderBounds$!.addEventListener('sl-change', function (evt) {
    const newDebug = { ...engine.debug };
    newDebug.collider.showBounds = !!evt.target.checked;
    updateDebug(newDebug);
});

const colliderBoundsColor$ = document.getElementById('collider-bounds-colors');
colliderBoundsColor$!.addEventListener('sl-input', evt => {
    const newDebug = { ...engine.debug };
    newDebug.collider.boundsColor = hexToColor(evt.target.value);
    updateDebug(newDebug);
});

const showGeometryBounds$ = document.getElementById('show-geometry-bounds');
showGeometryBounds$!.addEventListener('sl-change', function (evt) {
    const newDebug = { ...engine.debug };
    newDebug.collider.showGeometry = !!evt.target.checked;
    updateDebug(newDebug);
});

const colliderGeometryColor$ = document.getElementById('collider-geometry-colors');
colliderGeometryColor$!.addEventListener('sl-input', evt => {
    const newDebug = { ...engine.debug };
    newDebug.collider.geometryColor = hexToColor(evt.target.value);
    updateDebug(newDebug);
});


const updateInput = (pointer) => {

    if (pointer?.worldPos && pointer?.screenPos && pointer?.pagePos) {
        worldPos$!.innerText = `(${pointer.worldPos._x.toFixed(2)},${pointer.worldPos._y.toFixed(2)})`
        screenPos$!.innerText = `(${pointer.screenPos._x.toFixed(2)},${pointer.screenPos._y.toFixed(2)})`
        pagePos$!.innerText = `(${pointer.pagePos._x.toFixed(2)},${pointer.pagePos._y.toFixed(2)})`
    }
}


const updateStats = (debug: any) => {

    currentScene$!.innerText = engine.currentScene;
    scenes$!.innerText = engine.scenes.join(',');

    const fps = debug.stats.currFrame._fps;
    litFpsChart.draw(fps);
    litFrameTimeGraph.draw(
        debug.stats.currFrame._durationStats.total,
        debug.stats.currFrame._durationStats.update,
        debug.stats.currFrame._durationStats.draw, 
        debug.stats.currFrame._delta);

    litStatsList.updateStats({
        fps,
        delta: debug.stats.currFrame._delta,
        frameBudget: debug.stats.currFrame._delta - debug.stats.currFrame._durationStats.total,
        frameTime: debug.stats.currFrame._durationStats.total,
        updateTime: debug.stats.currFrame._durationStats.update,
        drawTime: debug.stats.currFrame._durationStats.draw,
        drawCalls: debug.stats.currFrame._graphicsStats.drawCalls,
        numActors: debug.stats.currFrame._actorStats.total
    });

    
}



const updateDebugSettings = (debug) => {

    showNames$!.checked = debug.entity.showName;
    showIds$!.checked = debug.entity.showId;

    showPos$!.checked = debug.transform.showPosition;
    showPosLabel$!.checked = debug.transform.showPositionLabel;
    const positionColor = debug.transform.positionColor;
    posColor$!.value = colorToHex(positionColor);

    showGraphicsBounds$!.checked = debug.graphics.showBounds;
    const graphicsColor = debug.graphics.boundsColor;
    graphicsBoundsColor$!.value = colorToHex(graphicsColor);

    showColliderBounds$!.checked = debug.collider.showBounds;
    const colliderColor = debug.collider.boundsColor;
    colliderBoundsColor$!.value = colorToHex(colliderColor);

    showGeometryBounds$!.checked = debug.collider.showGeometry;
    const geometryColor = debug.collider.geometryColor;
    colliderGeometryColor$!.value = colorToHex(geometryColor);
}

let entityListChanged = true;

const filterEntities$ = document.getElementById('filter-entities')
let entityFilter = '';
filterEntities$!.addEventListener('change', evt => {
    entityFilter = evt.target.value;
})
filterEntities$!.addEventListener('keyup', evt => {
    entityFilter = evt.target.value;
})

const showOffscreenEntities$ = document.getElementById('show-offscreen');
let showOffscreen = false;
showOffscreenEntities$!.addEventListener('sl-change', evt => {
    showOffscreen = !!evt.target.checked;
})

const entityListElement = document.querySelector('entity-list') as EntityList;


const updateEntityList = (entities) => {

    if (!showOffscreen) {
        entities = entities.filter(e => !e.tags.includes('ex.offscreen'));
    }

    if (entityFilter) {
        entities = entities.filter(e => e.name.includes(entityFilter));
    }

    if (entities.length !== entityList$!.children.length) {
        while(entityList$!.firstChild) {
            entityList$!.removeChild(entityList$!.firstChild);
        }
    }

    for (let entity of entities) {
        const entityDivId = 'entity-' + entity.id;
        const maybeDiv = document.getElementById(entityDivId);
        if (maybeDiv) {
            maybeDiv.children[0].innerText = entity.id;
            maybeDiv.children[1].innerText = entity.name;
            maybeDiv.children[2].innerText = entity.ctor;
            maybeDiv.children[3].innerText = entity.pos;
            maybeDiv.children[4].innerText = 'tags: ' + entity.tags.join(', ');

        } else {
            const div$ = document.createElement('div');
            div$.id = entityDivId;
            div$.className = 'entity';
            div$.addEventListener('mouseover', (evt) => {
                // selectActor(entity.id);
            });
            div$.addEventListener('click', (evt) => {
                selectActor(entity.id);
            });

            const id$ = document.createElement('div');
            id$.innerText = entity.id;
            id$.className = 'id';

            const name$ = document.createElement('div');
            name$.innerText = entity.name;
            name$.className = 'name';

            const ctor$ = document.createElement('div');
            ctor$.innerText = entity.ctor;
            ctor$.className = 'ctor';

            const pos$ = document.createElement('div');
            pos$.innerText = entity.pos;
            pos$.className = 'pos';

            const tags$ = document.createElement('div');
            tags$.className = 'tags'
            tags$.innerText = 'tags: ';

            const kill$ = document.createElement('button');
            kill$.setAttribute('entity-id', entity.id);
            kill$.addEventListener('click', evt => {
                const id = evt.target.getAttribute('entity-id');
                console.log('kill', id);
                killActor(+id);
                entityList$!.removeChild(div$);
            })

            div$.appendChild(id$);
            div$.appendChild(name$);
            div$.appendChild(ctor$);
            div$.appendChild(pos$);
            div$.appendChild(tags$);
            div$.appendChild(kill$);
            entityList$!.appendChild(div$);
            // entityMap.set(entity.id, div$);
        }
    }
}

backgroundConnection.onMessage.addListener((message) => {
    switch (message.name) {
        case 'scenes': {
            engine.scenes = message.data;
            break;
        }
        case 'current-scene': {
            engine.currentScene = message.data;
            currentScene$!.innerText = engine.currentScene;
            break;
        }
        case 'echo': {
            engine.currentScene = 'echo';
            currentScene$!.innerText = engine.currentScene;
            break;
        }
        case 'heartbeat':
        case 'install': {
            const debug = JSON.parse(message.data.debug);
            engine = message.data;
            engine.debug = debug;

            excaliburVersion$!.innerText = engine.version;
            updateInput(engine.pointer);
            updateStats(debug);
            entityListElement.entities = engine.entities;
            updateEntityList(engine.entities);
            updateDebugSettings(debug);
            break;
        }
        case 'collect-profiler': {
            const data = message.data;
            const flameChart = new flameChartJs.FlameChart({
                canvas: flameCanvas,
                data: [data],
                settings: {
                    styles: {
                        main: {
                            backgroundColor: '#1a1a1a'
                        }
                    }
                }
            });
            break;
        }
        default: {
            // console.warn('Unknown message', message);
        }
    }
});


// install content script telemetry
backgroundConnection.postMessage({
    name: 'init',
    tabId: chrome.devtools.inspectedWindow.tabId
});

backgroundConnection.postMessage({
    name: 'command',
    tabId: chrome.devtools.inspectedWindow.tabId,
    dispatch: 'install-heartbeat'
})
// debug
toggleDebugButton$!.addEventListener('click', () => {
    backgroundConnection.postMessage({
        name: 'command',
        tabId: chrome.devtools.inspectedWindow.tabId,
        dispatch: 'toggle-debug'
    });
});

// clock
toggleTestClock$!.addEventListener('click', () => {
    backgroundConnection.postMessage({
        name: 'command',
        tabId: chrome.devtools.inspectedWindow.tabId,
        dispatch: 'toggle-test-clock'
    })
});
startClock$!.addEventListener('click', () => {
    backgroundConnection.postMessage({
        name: 'command',
        tabId: chrome.devtools.inspectedWindow.tabId,
        dispatch: 'start-clock'
    })
});
stopClock$!.addEventListener('click', () => {
    backgroundConnection.postMessage({
        name: 'command',
        tabId: chrome.devtools.inspectedWindow.tabId,
        dispatch: 'stop-clock'
    })
});
stepClock$!.addEventListener('click', () => {
    backgroundConnection.postMessage({
        name: 'command',
        tabId: chrome.devtools.inspectedWindow.tabId,
        dispatch: 'step-clock',
        stepMs: +clockStepMs$!.value
    })
});

// profiler

startProfiler$!.addEventListener('click', () => {
    backgroundConnection.postMessage({
        name: 'command',
        tabId: chrome.devtools.inspectedWindow.tabId,
        dispatch: 'start-profiler',
        time: 30,
    })
});

collectProfiler$!.addEventListener('click', () => {
    backgroundConnection.postMessage({
        name: 'command',
        tabId: chrome.devtools.inspectedWindow.tabId,
        dispatch: 'collect-profiler'
    })
})

// Handles when user navigates and re-installs the content script telemetry
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete') {
        backgroundConnection.postMessage({
            name: 'init',
            tabId: chrome.devtools.inspectedWindow.tabId
        });

        backgroundConnection.postMessage({
            name: 'command',
            tabId: chrome.devtools.inspectedWindow.tabId,
            dispatch: 'install-heartbeat'
        })
    }
})
