if (typeof browser == "undefined") {
    // Chrome does not support the browser namespace yet.
    globalThis.browser = chrome;
}

function stepClock(stepMs) {
    if (!window.___EXCALIBUR_DEVTOOL) {
        console.log("no excalibur!!!");
        return;
    }

    const game = window.___EXCALIBUR_DEVTOOL;
    try {
        game.clock.step(stepMs)
    } catch {} // only works on test clock
}

function stopClock() {
    if (!window.___EXCALIBUR_DEVTOOL) {
        console.log("no excalibur!!!");
        return;
    }
    const game = window.___EXCALIBUR_DEVTOOL;
    game.clock.stop();
}

function startClock() {
    if (!window.___EXCALIBUR_DEVTOOL) {
        console.log("no excalibur!!!");
        return;
    }
    const game = window.___EXCALIBUR_DEVTOOL;
    game.clock.start();
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

function kill(actorId) {
    if (!window.___EXCALIBUR_DEVTOOL) {
        console.log("no excalibur!!!");
        return;
    }
    const game = window.___EXCALIBUR_DEVTOOL;
    const actor = game.currentScene.world.entityManager.getById(actorId);
    actor.kill();
}

function inject(settings) {
    if (!window.___EXCALIBUR_DEVTOOL) {
        console.log("no excalibur!!!");
        return;
    }

    const game = window.___EXCALIBUR_DEVTOOL;

    // Toggle debug
    if (settings.toggleDebug === true) {
        if (game.toggleDebug() === false) {
            game.toggleDebug();
        }
    } else if (settings.toggleDebug === false) {
        if (game.toggleDebug() === true) {
            game.toggleDebug();
        }
    }
    game.debug.entity.showName = settings.showNames;
    game.debug.entity.showId = settings.showIds;
    game.debug.transform.showPosition = settings.showPos;
    game.debug.transform.showPositionLabel = settings.showPosLabel;
    game.debug.transform.positionColor = settings.posColor;
    game.debug.graphics.showBounds = settings.showGraphicsBounds;
    game.debug.graphics.boundsColor = settings.graphicsBoundsColor;
    game.debug.collider.showBounds = settings.showColliderBounds;
    game.debug.collider.boundsColor = settings.colliderBoundsColor;
    game.debug.collider.showGeometry = settings.showGeometryBounds;
    game.debug.collider.geometryColor = settings.geometryBoundsColor;

    // Send game state to dev tools
    let currentScene = "root";
    const sceneNames = [];
    for (key of Object.keys(game.scenes)) {
        if (game.currentSceneName === key) {
            currentScene = key;
        }
        sceneNames.push(key);
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

    // Game data is stringyfied to ensure get properties are called.
    return JSON.stringify({
        version: game.version,
        currentScene: currentScene,
        scenes: sceneNames,
        pointer: {
            worldPos: game.input.pointers.primary.lastWorldPos,
            screenPos: game.input.pointers.primary.lastScreenPos,
            pagePos: game.input.pointers.primary.lastPagePos,
        },
        entities: entities,
        stats: game.debug.stats
    })
}

const debugSettings = {
  toggleDebug: false,
  showNames: false,
  showIds: false,
  showPos: false,
  showPosLabel: false,
  posColor: { r: 255, g: 255, b: 0, a: 1 },
  showGraphicsBounds: false,
  graphicsBoundsColor: { r: 255, g: 255, b: 0, a: 1 },
  showColliderBounds: false,
  colliderBoundsColor: { r: 0, g: 0, b: 255, a: 1 },
  showGeometryBounds: true,
  geometryBoundsColor: { r: 0, g: 255, b: 0, a: 1 },
};

let ports = {};
let intervalId = null;

async function getActiveTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    let [tab] = await browser.tabs.query(queryOptions);
    return tab;
}

function hasNoConnectedPorts() {
  return Object.keys(ports).length === 0
}

browser.runtime.onConnect.addListener(async (port) => {
    console.log("Connected:", port.name);
    ports[port.name] = port;

    port.onDisconnect.addListener(() => {
      console.log("Disconnected:", port.name);
      delete ports[port.name];

      if (hasNoConnectedPorts() && intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    });

    const tab = await getActiveTab();

    port.onMessage.addListener((message) => {
        console.log("Received message:", message);

        // https://parceljs.org/recipes/web-extension/#unexpected-messages
        if (message.__parcel_hmr_reload__) {
          return;
        }
        
        if (message.name === "command") {
            switch (message.dispatch) {
              case "toggle-test-clock": {
                  browser.scripting.executeScript({
                      target: { tabId: message.tabId },
                      world: 'MAIN',
                      func: toggleTestClock,
                  });
              }
              break;
              case "step-clock": {
                  browser.scripting.executeScript({
                      target: { tabId: message.tabId },
                      world: 'MAIN',
                      func: stepClock,
                      args: [message.stepMs],
                  });
              }
              break;
              case "start-clock": {
                  browser.scripting.executeScript({
                      target: { tabId: message.tabId },
                      world: 'MAIN',
                      func: startClock,
                  });
              }
              break;
              case "stop-clock": {
                  browser.scripting.executeScript({
                      target: { tabId: message.tabId },
                      world: 'MAIN',
                      func: stopClock,
                  });
              }
              case "kill": {
                  browser.scripting.executeScript({
                      target: { tabId: message.tabId },
                      world: 'MAIN',
                      func: kill,
                      args: [message.actorId]
                  });
              }
              break;
              case "toggle-debug":{
                  debugSettings.toggleDebug = !debugSettings.toggleDebug;
              }
              break;
              case "update-debug": {
                  const { debug } = message;
                  debugSettings.showNames = debug.showNames;
                  debugSettings.showIds = debug.showIds;
                  debugSettings.showPos = debug.showPos;
                  debugSettings.showPosLabel = debug.showPosLabel;
                  debugSettings.posColor = debug.posColor;
                  debugSettings.showGraphicsBounds = debug.showGraphicsBounds;
                  debugSettings.graphicsBoundsColor = debug.graphicsBoundsColor;
                  debugSettings.showColliderBounds = debug.showColliderBounds;
                  debugSettings.colliderBoundsColor = debug.colliderBoundsColor;
                  debugSettings.showGeometryBounds = debug.showGeometryBounds;
                  debugSettings.geometryBoundsColor = debug.geometryBoundsColor;
              }
              break;
              default:
                  console.warn("Unhandled dispatch:", message.dispatch);
                  break;
            }
        }
    });

    await ports[port.name].postMessage({
      name: "init",
      data: {
        settings: debugSettings,
      },
    });

    // Start sending messages every 200ms if not already running
    if (!intervalId) {
        intervalId = setInterval(async () => {
            const gameState = await browser.scripting.executeScript({
                target: {
                    tabId: tab.id,
                },
                world: "MAIN",
                func: inject,
                args: [debugSettings],
            });
            ports[port.name].postMessage({
              name: "heartbeat",
              data: gameState[0].result
            })
        }, 200);
    }
});