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

const backgroundConnection = chrome.runtime.connect({
    name: 'panel'
});

backgroundConnection.onMessage.addListener((message) => {
    console.log('panel got message', message)
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
});