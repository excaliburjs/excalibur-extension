
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


  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
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

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  game.clock.stop();
}

/**
 * Starts the clock.
 */
function startClock() {
  if (!window.___EXCALIBUR_DEVTOOL) {
    throw new Error('no excalibur!!!');
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  game.clock.start();
}

/**
 * Toggles between the test toggle and the standard clock.
 */
function toggleTestClock() {
  if (window.___EXCALIBUR_DEVTOOL) {

    /**
     * @typedef {import('./@types/excalibur').Engine} Engine
     * @type {Engine}
     */
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

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  const actor = game.currentScene.world.entityManager.getById(actorId);
  actor.kill();
}

/**
 * Identifies an actor.
 */
function identifyEntity(entityId) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    throw new Error("no excalibur!!!");
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  const actor = game.currentScene.world.entityManager.getById(entityId);
  if (actor === undefined) {
    throw new Error(`No entity found for id ${entityId}`)
  }
  actor.actions.repeat((context) => {
    context.fade(0, 200);
    context.fade(1, 200);
  }, 3);
}


/**
 * Set Color Blind Mode
 */
function setColorBlind(colorBlindMode) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    throw new Error("no excalibur!!!");
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  if (colorBlindMode === 'Normal') {
    game.debug.colorBlindMode.clear();
  } else {
    game.debug.colorBlindMode.simulate(colorBlindMode);
  }
}

/**
 * Go to scene
 */
function goToScene(sceneName) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    throw new Error("no excalibur!!!");
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  game.goToScene(sceneName);
}


/**
 * Updates physics related settings.
 * @typedef {import('./components/physics-settings').Physics} Physics
 * @param {Physics} settings
 */
function updatePhysics(settings) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    throw new Error('no excalibur!!!');
  }


  /**
  * Performs a deep merge of objects and returns mutated first object. 
  *
  * @param {...object} objects - Objects to merge
  * @returns {object} New object with merged key/values
  */
  function mergeDeep(...objects) {
    const isObject = obj => obj && typeof obj === 'object';

    return objects.reduce((prev, obj) => {
      Object.keys(obj).forEach(key => {
        const pVal = prev[key];
        const oVal = obj[key];
        if (Array.isArray(pVal) && Array.isArray(oVal)) {
          prev[key] = pVal.concat(...oVal);
        }
        else if (isObject(pVal) && isObject(oVal)) {
          prev[key] = mergeDeep(pVal, oVal);
        }
        else {
          prev[key] = oVal;
        }
      });
      return prev;
    }, objects[0]); // keep first object reference
  }


  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  game.physics = mergeDeep(game.physics, settings.config);
}

/**
 * Injects settings defined by the devtool into the game. Information about
 * the game state is then returned from this function.
 *
 *  @typedef {import('./components/debug-settings').Settings} DebugSettings
 *  @param {DebugSettings} settings 
 */
function inject(settings) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    throw new Error('no excalibur!!!');
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;

  // Micro re-implementation of ex-color
  class ColorLike {
    constructor({ r, g, b, a }) {
      this.r = r;
      this.g = g;
      this.b = b;
      this.a = a != null && a != undefined ? a : 1;
    }
    clone(dest) {
      const result = dest || new ColorLike({ r: this.r, g: this.g, b: this.b, a: this.a });
      result.r = this.r;
      result.g = this.g;
      result.b = this.b;
      result.a = this.a;
      return result;
    }
  }


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

  // Debug text color (only available in v0.31+)
  if (game.debug.settings?.text) {
    game.debug.settings.text.foreground = new ColorLike(settings.debugTextForegroundColor);
    game.debug.settings.text.background = new ColorLike(settings.debugTextBackgroundColor);
    game.debug.settings.text.border = new ColorLike(settings.debugTextBorderColor);
  }

  // Entity
  game.debug.entity.showName = settings.showNames;
  game.debug.entity.showId = settings.showIds;

  // Transform
  game.debug.transform.showPosition = settings.showPos;
  game.debug.transform.showPositionLabel = settings.showPosLabel;
  game.debug.transform.positionColor = settings.posColor;

  game.debug.transform.showRotation = settings.showRotation;
  game.debug.transform.rotationColor = settings.rotationColor;

  game.debug.transform.showScale = settings.showScale;
  game.debug.transform.scaleColor = settings.scaleColor;

  game.debug.transform.showZIndex = settings.showZIndex;

  // Components
  game.debug.graphics.showBounds = settings.showGraphicsBounds;
  game.debug.graphics.boundsColor = settings.graphicsBoundsColor;
  game.debug.collider.showBounds = settings.showColliderBounds;
  game.debug.collider.boundsColor = settings.colliderBoundsColor;
  game.debug.collider.showGeometry = settings.showGeometryBounds;
  game.debug.collider.geometryColor = settings.geometryBoundsColor;

  game.debug.body.showCollisionGroup = settings.showCollisionGroup;
  game.debug.body.showCollisionType = settings.showCollisionType;
  game.debug.body.showMass = settings.showMass;
  game.debug.body.showSleeping = settings.showSleeping;
  game.debug.body.showMotion = settings.showMotion;


  // Physics
  game.debug.physics.showCollisionContacts = settings.showContact;
  game.debug.physics.collisionContactColor = settings.contactColor;
  game.debug.physics.showCollisionNormals = settings.showContactNormal;
  game.debug.physics.collisionNormalColor = settings.contactNormalColor;
  game.debug.physics.showBroadphaseSpacePartitionDebug = settings.showSpacePartition;

  // Tilemap & Isometric
  game.debug.tilemap.showGrid = settings.showTileMapGrid;
  game.debug.tilemap.gridColor = settings.tileMapGridColor;
  game.debug.isometric.showGrid = settings.showIsometricGrid;
  game.debug.isometric.gridColor = settings.isometricGridColor;

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

  const {scenes: _, ...config } = game._originalOptions;

  // Game data is stringified to ensure get properties are called.
  return JSON.stringify({
    version: game.version,
    /**
     * @typedef {import('./@types/excalibur.d.ts').EngineOptions} EngineOptions
     * @type {EngineOptions}
     */
    config: { ...config },
    screen: {
      viewport: game.screen?.viewport,
      resolution: game.screen?.resolution,
      displayMode: game.screen?.displayMode,
      pixelRatio: game.screen?.pixelRatio,
      unsafeArea: game.screen?.unsafeArea,
      contentArea: game.screen?.contentArea
    },
    camera: {
      pos: game.currentScene.camera?.pos?.clone(),
      vel: game.currentScene.camera?.vel?.clone(),
      acc: game.currentScene.camera?.acc?.clone(),
      strategies: game.currentScene.camera?.strategies?.map(s => ({ name: s.constructor.name }))
    },
    currentScene: currentScene,
    scenes: sceneNames,
    pointer: {
      worldPos: game.input.pointers?.primary?.lastWorldPos,
      screenPos: game.input.pointers?.primary?.lastScreenPos,
      pagePos: game.input.pointers?.primary?.lastPagePos
    },
    entities: entities,
    stats: game.debug?.stats,
    physics: {
      enabled: !!game.physics?.enabled,
      maxFps: game.maxFps,
      fixedUpdateFps: game.fixedUpdateFps,
      fixedUpdateTimestep: game.fixedUpdateTimestep,
      gravity: game.currentScene.physics.config?.gravity ?? { _x: 0, _y: 0 },
      solverStrategy: game.currentScene.physics.config?.solver ?? 'arcade',
      config: { ...game.currentScene.physics.config }
    }
  });
}

/**
 *  Sets the actual defaults
 *  @typedef {import('./components/debug-settings').Settings DebugSettings
 *  @type DebugSettings
 */
const debugSettings = {
  toggleDebug: false,
  debugTextForegroundColor: { r: 0, g: 0, b: 0, a: 1 },
  debugTextBackgroundColor: { r: 0, g: 0, b: 0, a: 0 },
  debugTextBorderColor: { r: 0, g: 0, b: 0, a: 0 },
  showNames: false,
  showIds: false,
  showPos: false,
  showPosLabel: false,
  posColor: { r: 255, g: 255, b: 0, a: 1 },

  showScale: false,
  scaleColor: { r: 0, g: 0, b: 0, a: 1 },

  showRotation: false,
  rotationColor: { r: 0, g: 0, b: 0, a: 1 },

  showGraphicsBounds: false,
  graphicsBoundsColor: { r: 255, g: 255, b: 0, a: 1 },
  showColliderBounds: false,
  colliderBoundsColor: { r: 0, g: 0, b: 255, a: 1 },
  showGeometryBounds: true,
  geometryBoundsColor: { r: 0, g: 255, b: 0, a: 1 },
  showCollisionGroup: false,
  showCollisionType: false,
  showMotion: false,
  showSleeping: false,
  showMass: false,

  showContact: false,
  contactColor: { r: 255, g: 0, b: 0, a: 1 },
  showContactNormal: false,
  contactNormalColor: { r: 255, g: 0, b: 0, a: 1 },

  showSpacePartition: false,

  showTileMapGrid: false,
  tileMapGridColor: { r: 0, g: 0, b: 0, a: 1 },
  showIsometricGrid: false,
  isometricGridColor: { r: 0, g: 0, b: 0, a: 1 },
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
        case "color-blind":
          {
            globalThis.browser.scripting.executeScript({
              target: { tabId: message.tabId },
              world: 'MAIN',
              func: setColorBlind,
              args: [message.colorBlindMode]
            });
          }
          break;
        case "goto-scene":
          {
            globalThis.browser.scripting.executeScript({
              target: { tabId: message.tabId },
              world: 'MAIN',
              func: goToScene,
              args: [message.sceneName]
            });
          }
          break;
        case "identify-actor":
          {
            globalThis.browser.scripting.executeScript({
              target: { tabId: message.tabId },
              world: "MAIN",
              func: identifyEntity,
              args: [message.actorId],
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
            /**
             *  @typedef {import('./components/debug-settings').Settings DebugSettings
             *  @type {DebugSettings}
             */
            const debug = message.debug;

            // Debug Text
            debugSettings.debugTextForegroundColor = debug.debugTextForegroundColor;
            debugSettings.debugTextBackgroundColor = debug.debugTextBackgroundColor;
            debugSettings.debugTextBorderColor = debug.debugTextBorderColor;

            // Entity
            debugSettings.showNames = debug.showNames;
            debugSettings.showIds = debug.showIds;

            // Transform
            debugSettings.showPos = debug.showPos;
            debugSettings.showPosLabel = debug.showPosLabel;
            debugSettings.posColor = debug.posColor;

            debugSettings.showRotation = debug.showRotation;
            debugSettings.rotationColor = debug.rotationColor;

            debugSettings.showScale = debug.showScale;
            debugSettings.scaleColor = debug.scaleColor;

            debugSettings.showZIndex = debug.showZIndex;

            // Components
            debugSettings.showGraphicsBounds = debug.showGraphicsBounds;
            debugSettings.graphicsBoundsColor = debug.graphicsBoundsColor;
            debugSettings.showColliderBounds = debug.showColliderBounds;
            debugSettings.colliderBoundsColor = debug.colliderBoundsColor;
            debugSettings.showGeometryBounds = debug.showGeometryBounds;
            debugSettings.geometryBoundsColor = debug.geometryBoundsColor;
            debugSettings.showCollisionGroup = debug.showCollisionGroup;
            debugSettings.showCollisionType = debug.showCollisionType;
            debugSettings.showMass = debug.showMass;
            debugSettings.showMotion = debug.showMotion;
            debugSettings.showSleeping = debug.showSleeping;

            // Physics
            debugSettings.showContact = debug.showContact;
            debugSettings.contactColor = debug.contactColor;
            debugSettings.showContactNormal = debug.showContactNormal;
            debugSettings.contactNormalColor = debug.contactNormalColor;

            debugSettings.showSpacePartition = debug.showSpacePartition;

            // Tilemap
            debugSettings.showTileMapGrid = debug.showTileMapGrid;
            debugSettings.tileMapGridColor = debug.tileMapGridColor;
            debugSettings.showIsometricGrid = debug.showIsometricGrid;
            debugSettings.isometricGridColor = debug.isometricGridColor;

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
