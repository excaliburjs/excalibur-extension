console.log('hello from panel');

const toggleDebugButton$ = document.getElementById('toggle-debug');
const currentScene$ = document.getElementById('current-scene-name');
const scenes$ = document.getElementById('scenes');
const debugSettingsRaw$ = document.getElementById('debug-settings-raw');

const fps$ = document.getElementById('fps');
const frameTime$ = document.getElementById('frame-time');
const frameBudget$ = document.getElementById('frame-budget');
const updateTime$ = document.getElementById('update-time');
const drawTime$ = document.getElementById('draw-time');
const drawCalls$ = document.getElementById('draw-calls');
const numActors$ = document.getElementById('num-actors');

const backgroundConnection = chrome.runtime.connect({
    name: 'panel'
});

// Current Engine representation in the extension
let engine = {
    currentScene: 'root',
    debug: {},
    scenes: [],
    entities: []
}

backgroundConnection.onMessage.addListener((message) => {
    switch(message.name) {
        case 'scenes': {
            engine.scenes = message.data;
            break;
        }
        case 'current-scene': {
            engine.currentScene = message.data;
            currentScene$.innerText = engine.currentScene;
            break;
        }
        case 'echo': {
            engine.currentScene = 'echo';
            currentScene$.innerText = engine.currentScene;
            break;
        }
        case 'heartbeat':
        case 'install': {
            engine = message.data;
            const debug = JSON.parse(message.data.debug);
            currentScene$.innerText = engine.currentScene;
            scenes$.innerText = engine.scenes.join(',');
            fps$.innerText = debug.stats.currFrame._fps.toFixed(2);
            const delta = debug.stats.currFrame._delta;
            const frameBudget = (delta - debug.stats.currFrame._durationStats.total);
            const frameTime = debug.stats.currFrame._durationStats.total;
            frameTime$.innerText = `${frameTime.toFixed(2)}ms (${((frameTime/delta) * 100).toFixed(2)}%)`;
            drawTime$.innerText = debug.stats.currFrame._durationStats.draw.toFixed(2);
            updateTime$.innerText = debug.stats.currFrame._durationStats.update.toFixed(2);
            frameBudget$.innerText = `${frameBudget.toFixed(2)}ms (${((frameBudget/delta) * 100).toFixed(2)}%)`
            numActors$.innerText = debug.stats.currFrame._actorStats.total;
            drawCalls$.innerText = debug.stats.currFrame._graphicsStats.drawCalls;
            // debugSettingsRaw$.innerText = JSON.stringify(debug, null, 2);
            break;
        }
        default: {
            console.warn('Unknown message', message);
        }
    }
});

backgroundConnection.postMessage({
    name: 'init',
    tabId: chrome.devtools.inspectedWindow.tabId
});

backgroundConnection.postMessage({
    name: 'command',
    tabId: chrome.devtools.inspectedWindow.tabId,
    dispatch: 'install-heartbeat'
})

toggleDebugButton$.addEventListener('click', () => {
    backgroundConnection.postMessage({
        name: 'command',
        tabId: chrome.devtools.inspectedWindow.tabId,
        dispatch: 'toggle-debug'
    });
});