console.log('hello from panel');

// const connection = chrome.tabs.connect(chrome.devtools.inspectedWindow.tabId, {name: 'knockknock'});

// connection.postMessage({ping: 'pong'});
// connection.onMessage.addListener((message) => {
//     console.log('panel message', message);
// });

// chrome.runtime.onMessage.addListener(
//     function(request, sender, sendResponse) {
//       console.log(sender.tab ?
//                   "from a content script:" + sender.tab.url :
//                   "from the extension");
//       if (request.greeting === "hello")
//         sendResponse({farewell: "goodbye"});
//     }
//   );

const toggleDebugButton$ = document.getElementById('toggle-debug');

const currentScene$ = document.getElementById('current-scene-name');

const backgroundConnection = chrome.runtime.connect({
    name: 'panel'
});

// Current Engine representation in the extension
const engine = {
    currentScene: 'root',
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
        dispatch: 'echo'
    });
});