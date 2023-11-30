console.log('hello from panel');

const toggleDebugButton$ = document.getElementById('toggle-debug');
const currentScene$ = document.getElementById('current-scene-name');
const scenes$ = document.getElementById('scenes');
const debugSettingsRaw$ = document.getElementById('debug-settings-raw');

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
        case 'install': {
            engine = message.data;
            currentScene$.innerText = engine.currentScene;
            scenes$.innerText = engine.scenes.join(',');
            debugSettingsRaw$.innerText = JSON.stringify(JSON.parse(message.data.debug), null, 2);
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

toggleDebugButton$.addEventListener('click', () => {
    backgroundConnection.postMessage({
        name: 'command',
        tabId: chrome.devtools.inspectedWindow.tabId,
        dispatch: 'toggle-debug'
    });
    backgroundConnection.postMessage({
        name: 'command',
        tabId: chrome.devtools.inspectedWindow.tabId,
        dispatch: 'install'
    });
});