if (typeof browser == 'undefined') {
  // Chrome does not support the browser namespace yet.
  globalThis.browser = globalThis.chrome;
}

/**
 * Steps the clock forwarding the amount of milliseconds passed.
 */
function stepClock(stepMs) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    throw new Error('no excalibur!!!');
  }

  const game = window.___EXCALIBUR_DEVTOOL;
  try {
    game.clock.step(stepMs);
  } catch {
    // only works on test clock
  }
}

/**
 * Stops the clock.
 */
function stopClock() {
  if (!window.___EXCALIBUR_DEVTOOL) {
    throw new Error('no excalibur!!!');
  }
  const game = window.___EXCALIBUR_DEVTOOL;
  game.clock.stop();
}

/**
 * Starts the clock.
 */
function startClock() {
  if (!window.___EXCALIBUR_DEVTOOL) {
    throw new Error('no excalibur!!!');
  }
  const game = window.___EXCALIBUR_DEVTOOL;
  game.clock.start();
}

/**
 * Toggles between the test toggle and the standard clock.
 */
function toggleTestClock() {
  if (window.___EXCALIBUR_DEVTOOL) {
    const game = window.___EXCALIBUR_DEVTOOL;
    if (!window.___EXCALIBUR_DEVTOOL_EXTENSION_TESTCLOCK) {
      window.___EXCALIBUR_DEVTOOL_EXTENSION_TESTCLOCK = true;
      game.debug.useTestClock();
    } else {
      window.___EXCALIBUR_DEVTOOL_EXTENSION_TESTCLOCK = false;
      game.debug.useStandardClock();
    }
  }
}

/**
 * Kills an actor.
 */
function kill(actorId) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    throw new Error('no excalibur!!!');
  }
  const game = window.___EXCALIBUR_DEVTOOL;
  const actor = game.currentScene.world.entityManager.getById(actorId);
  actor.kill();
}

/**
 * Updates physics related settings.
 */
function updatePhysics(settings) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    throw new Error('no excalibur!!!');
  }
  const game = window.___EXCALIBUR_DEVTOOL;
  game.physics.enabled = settings.enabled;
  game.physics.solver = settings.solverStrategy;
}

/**
 * Injects settings defined by the devtool into the game. Information about
 * the game state is then returned from this function.
 */
function inject(settings) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    throw new Error('no excalibur!!!');
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
  let currentScene = 'root';
  const sceneNames = [];
  for (const key of Object.keys(game.scenes)) {
    if (game.currentSceneName === key) {
      currentScene = key;
    }
    sceneNames.push(key);
  }

  const entities = [];
  for (const entity of game.currentScene.entities) {
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

  // Game data is stringified to ensure get properties are called.
  return JSON.stringify({
    version: game.version,
    currentScene: currentScene,
    scenes: sceneNames,
    pointer: {
      worldPos: game.input.pointers.primary.lastWorldPos,
      screenPos: game.input.pointers.primary.lastScreenPos,
      pagePos: game.input.pointers.primary.lastPagePos
    },
    entities: entities,
    stats: game.debug.stats,
    physics: {
      enabled: game.physics.enabled,
      maxFps: game.maxFps,
      fixedUpdateFps: game.fixedUpdateFps,
      fixedUpdateTimestep: game.fixedUpdateTimestep,
      gravity: game.currentScene.physics.config.gravity,
      solverStrategy: game.currentScene.physics.config.solver
    }
  });
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
  geometryBoundsColor: { r: 0, g: 255, b: 0, a: 1 }
};

const ports = {};
let intervalId = null;

/**
 * Gets the active browser tab.
 */
async function getActiveTab() {
  const queryOptions = { active: true, lastFocusedWindow: true };
  const [tab] = await globalThis.browser.tabs.query(queryOptions);
  return tab;
}

/**
 * Determines if any ports are connected.
 */
function hasNoConnectedPorts() {
  return Object.keys(ports).length === 0;
}

globalThis.browser.runtime.onConnect.addListener(async (port) => {
  console.info('Connected:', port.name);
  ports[port.name] = port;

  port.onDisconnect.addListener(() => {
    console.info('Disconnected:', port.name);
    delete ports[port.name];

    if (hasNoConnectedPorts() && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  });

  const tab = await getActiveTab();

  port.onMessage.addListener((message) => {
    console.info('Received message:', message);

    // https://parceljs.org/recipes/web-extension/#unexpected-messages
    if (message.__parcel_hmr_reload__) {
      return;
    }

    if (message.name === 'command') {
      switch (message.dispatch) {
        case 'toggle-test-clock':
          {
            globalThis.browser.scripting.executeScript({
              target: { tabId: message.tabId },
              world: 'MAIN',
              func: toggleTestClock
            });
          }
          break;
        case 'step-clock':
          {
            globalThis.browser.scripting.executeScript({
              target: { tabId: message.tabId },
              world: 'MAIN',
              func: stepClock,
              args: [message.stepMs]
            });
          }
          break;
        case 'start-clock':
          {
            globalThis.browser.scripting.executeScript({
              target: { tabId: message.tabId },
              world: 'MAIN',
              func: startClock
            });
          }
          break;
        case 'stop-clock':
          {
            globalThis.browser.scripting.executeScript({
              target: { tabId: message.tabId },
              world: 'MAIN',
              func: stopClock
            });
          }
          break;
        case 'kill':
          {
            globalThis.browser.scripting.executeScript({
              target: { tabId: message.tabId },
              world: 'MAIN',
              func: kill,
              args: [message.actorId]
            });
          }
          break;
        case 'toggle-debug':
          {
            debugSettings.toggleDebug = !debugSettings.toggleDebug;
          }
          break;
        case 'update-debug':
          {
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
        case 'update-physics':
          {
            globalThis.browser.scripting.executeScript({
              target: { tabId: message.tabId },
              world: 'MAIN',
              func: updatePhysics,
              args: [message.physics]
            });
          }
          break;
        default:
          console.info('Unhandled dispatch:', message.dispatch);
          break;
      }
    }
  });

  await ports[port.name].postMessage({
    name: 'init',
    data: {
      settings: debugSettings
    }
  });

  // Start sending messages every 200ms if not already running
  if (!intervalId) {
    intervalId = setInterval(async () => {
      const gameState = await globalThis.browser.scripting.executeScript({
        target: {
          tabId: tab.id
        },
        world: 'MAIN',
        func: inject,
        args: [debugSettings]
      });
      ports[port.name].postMessage({
        name: 'heartbeat',
        data: gameState[0].result
      });
    }, 200);
  }
});
