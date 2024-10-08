if (typeof browser == "undefined") {
    // Chrome does not support the browser namespace yet.
    globalThis.browser = chrome;
}

function toggleDebug() {
    if ((window).___EXCALIBUR_DEVTOOL) {
        console.log('toggleDebug()');
        const game = window.___EXCALIBUR_DEVTOOL;
        game.toggleDebug();
    } else {
        console.log('no excalibur!!!');
    }
}

function installHeartBeat(pollingInterval = 200) {
    // Use excalibur's built in global
    if ((window).___EXCALIBUR_DEVTOOL) {
        const game = window.___EXCALIBUR_DEVTOOL;

        if (!window.___EXCALIBUR_DEVTOOL_EXTENSION_INSTALLED) {
            window.___EXCALIBUR_DEVTOOL_EXTENSION_INSTALLED = true;
            let pointer = {
                worldPos: null,
                screenPos: null,
                pagePos: null
            };
            game.input.pointers.primary.on('move', evt => {
                pointer.worldPos = evt.worldPos;
                pointer.screenPos = evt.screenPos;
                pointer.pagePos = evt.pagePos;
            });

            setInterval(() => {

                let currentSceneName = 'root';
                let sceneNames = [];
                for (let [name, value] of Object.entries(game.scenes)) {
                    if (game.currentScene === value) {
                        currentSceneName = name;
                    }
                    sceneNames.push(name);
                }

                let entities = [];
                for (let entity of game.currentScene.entities) {
                    const pos = `(${entity?.pos?.x?.toFixed(2)}, ${entity?.pos?.y?.toFixed(2)})`;
                    const tags = Array.from(entity.tags);
                    entities.push({
                        id: entity.id,
                        name: entity.name,
                        ctor: entity.constructor.name,
                        pos: pos ?? 'none',
                        tags
                    });
                }

                window.postMessage({
                    source: 'excalibur-dev-tools',
                    name: 'heartbeat',
                    data: {
                        version: game.version ?? 'unknown',
                        debug: JSON.stringify({ ...game.debug, _engine: undefined, colorBlindMode: undefined }),
                        currentScene: currentSceneName,
                        scenes: sceneNames,
                        pointer,
                        entities
                    }
                });
            }, pollingInterval);
        }
    }
}

function startProfiler(time) {
    if ((window).___EXCALIBUR_DEVTOOL && window.ex) {
        console.log('Starting excalibur profiler');
        ex.Profiler.init();
        // Only allow 1 second for now
        setTimeout(() => {
            console.log('Collecting excalibur profiler');
            const data = ex.Profiler.collect();
            window.postMessage({
                source: 'excalibur-dev-tools',
                name: 'collect-profiler',
                data
            });
        }, time ?? 100);
    }
}

function collectProfiler() {
    if ((window).___EXCALIBUR_DEVTOOL && window.ex) {
        const data = ex.Profiler.collect();
        console.log('Collecting excalibur profiler');
        window.postMessage({
            source: 'excalibur-dev-tools',
            name: 'collect-profiler',
            data
        });
    }
}

function updateDebug(debug) {
    if ((window).___EXCALIBUR_DEVTOOL) {
        const game = window.___EXCALIBUR_DEVTOOL;
        const { filter, entity, transform, graphics, collider } = debug;
        game.debug = { ...game.debug, filter, entity, transform, graphics, collider };
    }
}

function kill(actorId) {
    if ((window).___EXCALIBUR_DEVTOOL) {
        const game = window.___EXCALIBUR_DEVTOOL;
        const actor = game.currentScene.world.entityManager.getById(actorId);
        actor.kill();
    }
}

async function goto(scene) {
    if ((window).___EXCALIBUR_DEVTOOL) {
        const game = window.___EXCALIBUR_DEVTOOL;
        return await game.director.swapScene(scene);
    }
}

function toggleTestClock() {
    if ((window).___EXCALIBUR_DEVTOOL) {

        const game = window.___EXCALIBUR_DEVTOOL;
        if (!(window).___EXCALIBUR_DEVTOOL_EXTENSION_TESTCLOCK) {
            (window).___EXCALIBUR_DEVTOOL_EXTENSION_TESTCLOCK = true;
            game.debug.useTestClock();
        } else {
            (window).___EXCALIBUR_DEVTOOL_EXTENSION_TESTCLOCK = false;
            game.debug.useStandardClock();
        }

    }
}

function startClock() {
    if ((window).___EXCALIBUR_DEVTOOL) {
        const game = window.___EXCALIBUR_DEVTOOL;
        game.clock.start();
    }
}
function stopClock() {
    if ((window).___EXCALIBUR_DEVTOOL) {
        const game = window.___EXCALIBUR_DEVTOOL;
        game.clock.stop();
    }
}
function stepClock(stepMs) {
    if ((window).___EXCALIBUR_DEVTOOL) {
        const game = window.___EXCALIBUR_DEVTOOL;
        try {
            game.clock.step(stepMs)
        } catch {} // only works on test clock
    }
}

function echo() {
    console.log('echo()');
    window.postMessage({
        source: 'excalibur-dev-tools',
        name: 'echo'
    });
}


var connections = {};

var popup = null;

browser.runtime.onConnect.addListener(function (port) {

    var extensionListener = function (message, sender, sendResponse) {
        if (message.__parcel_hmr_reload__) {
            return;
        }

        if (message.name === 'init-popup') {
            popup = sender;
            popup.postMessage({name: 'test'});
            return;
        }

        // The original connection event doesn't include the tab ID of the
        // DevTools page, so we need to send it explicitly.
        if (message.name === 'init') {
            connections[message.tabId] = port;
            return;
        }

        // other message handling
        if (message.name === 'command') {
            switch (message.dispatch) {
                case 'toggle-debug': {
                    // send command to excalibur on the page via a executed script
                    // https://developer.chrome.com/docs/extensions/mv3/content_scripts/
                    browser.scripting.executeScript({
                        target: { tabId: message.tabId },
                        world: 'MAIN',
                        func: toggleDebug
                    });
                    break;
                }
                case 'install-heartbeat': {
                    browser.scripting.executeScript({
                        target: { tabId: message.tabId },
                        world: 'MAIN',
                        func: installHeartBeat
                    });
                    break;
                }
                case 'echo': {
                    browser.scripting.executeScript({
                        target: { tabId: message.tabId },
                        world: 'MAIN',
                        func: echo
                    });
                    break;
                }
                case 'update-debug': {
                    browser.scripting.executeScript({
                        target: { tabId: message.tabId },
                        world: 'MAIN',
                        func: updateDebug,
                        args: [message.debug]
                    });
                    break;
                }
                case 'kill': {
                    browser.scripting.executeScript({
                        target: { tabId: message.tabId },
                        world: 'MAIN',
                        func: kill,
                        args: [message.actorId]
                    });
                    break;
                }
                case 'goto': {
                    browser.scripting.executeScript({
                        target: { tabId: message.tabId },
                        world: 'MAIN',
                        func: goto,
                        injectImmediately: true,
                        args: [message.scene]
                    });
                }
                case 'toggle-test-clock': {
                    browser.scripting.executeScript({
                        target: { tabId: message.tabId },
                        world: 'MAIN',
                        func: toggleTestClock
                    });
                    break;
                }
                case 'start-clock': {
                    browser.scripting.executeScript({
                        target: { tabId: message.tabId },
                        world: 'MAIN',
                        func: startClock
                    });
                    break;
                }
                case 'stop-clock': {
                    browser.scripting.executeScript({
                        target: { tabId: message.tabId },
                        world: 'MAIN',
                        func: stopClock
                    });
                    break;
                }
                case 'step-clock': {
                    browser.scripting.executeScript({
                        target: { tabId: message.tabId },
                        world: 'MAIN',
                        func: stepClock,
                        args: [message.stepMs]
                    });
                    break;
                }
                case 'start-profiler': {
                    browser.scripting.executeScript({
                        target: { tabId: message.tabId },
                        world: 'MAIN',
                        func: startProfiler,
                        args: [message.time]
                    });
                    break;
                }
                case 'collect-profiler': {
                    browser.scripting.executeScript({
                        target: { tabId: message.tabId },
                        world: 'MAIN',
                        func: collectProfiler
                    });
                    break;
                }
            }
        }
    }

    // Listen to messages sent from the DevTools page
    port.onMessage.addListener(extensionListener);

    port.onDisconnect.addListener(function (port) {
        port.onMessage.removeListener(extensionListener);

        var tabs = Object.keys(connections);
        for (var i = 0, len = tabs.length; i < len; i++) {
            if (connections[tabs[i]] == port) {
                delete connections[tabs[i]]
                break;
            }
        }
    });
});

// Receive message from content script and relay to the devTools page for the
// current tab
browser.runtime.onMessage.addListener(function (request, sender, sendResponse) {
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
});