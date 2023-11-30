function toggleDebug() {
    if ((window).___EXCALIBUR_DEVTOOL) {
        console.log('toggleDebug()');
        const game = window.___EXCALIBUR_DEVTOOL;
        game.toggleDebug();
    } else {
        console.log('no excalibur!!!');
    }
}

function installExcaliburMessager() {
    console.log('echo()');
    window.postMessage({
        source: 'excalibur-dev-tools',
        name: 'echo'
    });
}


var connections = {};

chrome.runtime.onConnect.addListener(function (port) {

    var extensionListener = function (message, sender, sendResponse) {

        // The original connection event doesn't include the tab ID of the
        // DevTools page, so we need to send it explicitly.
        if (message.name === 'init') {
          connections[message.tabId] = port;
          return;
        }

	    // other message handling
        if (message.name === 'command') {
            switch(message.dispatch) {
                case 'toggle-debug': {
                    // send command to excalibur on the page via a executed script
                    // https://developer.chrome.com/docs/extensions/mv3/content_scripts/
                    chrome.scripting.executeScript({
                        target: {tabId: message.tabId },
                        world: 'MAIN',
                        func: toggleDebug
                    }).then(injectionResults => {
                        console.log(injectionResults);
                    });
                    break;
                }
                case 'echo': {
                    chrome.scripting.executeScript({
                        target: {tabId: message.tabId },
                        world: 'MAIN',
                        func: installExcaliburMessager
                    }).then(injectionResults => {
                        console.log(injectionResults);
                    });
                    break;
                }
            }
        }
    }

    // Listen to messages sent from the DevTools page
    port.onMessage.addListener(extensionListener);

    port.onDisconnect.addListener(function(port) {
        port.onMessage.removeListener(extensionListener);

        var tabs = Object.keys(connections);
        for (var i=0, len=tabs.length; i < len; i++) {
          if (connections[tabs[i]] == port) {
            delete connections[tabs[i]]
            break;
          }
        }
    });
});

// Receive message from content script and relay to the devTools page for the
// current tab
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // Messages from content scripts should have sender.tab set
    if (sender.tab) {
      var tabId = sender.tab.id;
      if (tabId in connections) {
        connections[tabId].postMessage(request);
      } else {
        console.log("Tab not found in connection list.");
      }
    } else {
      console.log("sender.tab not defined.");
    }
    return true;
});