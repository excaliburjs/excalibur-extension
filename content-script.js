console.log('hello from excalibur dev tools content script!')


window.addEventListener('message', function (event) {
    // Only accept messages from the same frame
    if (event.source !== window) {
        return;
    }

    var message = event.data;

    // Only accept messages that we know are ours
    if (typeof message !== 'object' || message === null ||
        message.source !== 'my-devtools-extension') {
        return;
    }

    chrome.runtime.sendMessage(message);
});

chrome.runtime.sendMessage({
    type: 'hello'
});

// if ((window).___EXCALIBUR_DEVTOOL) {
//     console.log('has excalibur!');
// }
// window.devToolsExtensionID = undefined; //'jbnfhjabhgonbpiifocmpajmjmjplcpd'

// // chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
// //     console.log(sender.tab ? 'from a content script' : 'from the extension');
// //     sendResponse({test: 'hello'});
// // });

// // chrome.runtime.onConnect.addListener((port) => {
// //     console.log('connected to extension');
// //     port.postMessage({hello: 'goodbye'});
// // });

// // chrome.runtime.onConnect.addListener((evt) => {
// //     console.log('connection', evt);
// // });

// // var port = chrome.runtime.connect({name: "knockknock"});
// // port.onDisconnect.addListener((port) => {
// //     console.log('disconnected', port.name)
// // })
// // port.postMessage({joke: "Knock knock"});
// // port.onMessage.addListener((msg) => {
// //     console.log('client-script message', msg)
// //   if (msg.question === "Who's there?")
// //     port.postMessage({answer: "Madame"});
// //   else if (msg.question === "Madame who?")
// //     port.postMessage({answer: "Madame... Bovary"});
// // });


// // (async () => {
// //     const response = await chrome.runtime.sendMessage('jbnfhjabhgonbpiifocmpajmjmjplcpd', {greeting: "hello"});
// //     // do something with response here, not outside the function
// //     console.log(response);
// // })();

// let connection;
// function connect() {
//     const name = 'tab';
//     if (window.devToolsExtensionID) {
//         connection = chrome.runtime.connect(window.devToolsExtensionID, { name });
//     } else {
//         connection = chrome.runtime.connect({ name });
//     }

//     connection.onDisconnect.addListener((port) => {
//         console.log('disconnected', port.name)
//     })

//     connection.onMessage.addListener((message) => {
//         console.log('content script message', message);
//     })

//     connection.postMessage({message: 'from content script connect'});
// }

// connect();

// function handleMessages(message) {
//     console.log('window listener', message);
// }
// window.addEventListener('message', handleMessages, false);