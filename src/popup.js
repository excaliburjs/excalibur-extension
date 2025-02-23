// const backgroundConnection = chrome.runtime.connect({
//     name: 'popup'
// });

// const excaliburVersion$ = document.getElementById('excalibur-version');

// const updateStats = () => {

// }

// const updateDebugSettings = () => {

// }

// backgroundConnection.postMessage({
//     name: 'init-popup'
// });

// backgroundConnection.onMessage.addListener((message) => {
//     switch (message.name) {
//         case 'heartbeat':
//         case 'install': {
//             const debug = JSON.parse(message.data.debug);
//             excaliburVersion$.innerText = engine.version;
//             updateStats(debug);
//             updateDebugSettings(debug);
//             break;
//         }
//         default: {
//             // console.warn('Unknown message', message);
//         }
//     }
// });

// backgroundConnection.onDisconnect.addListener(message => {
//     console.log(message);
// });
