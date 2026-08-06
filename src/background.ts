import { settingsMappings } from './settings';
import type { Engine, TestClock } from './@types/excalibur';
import type { ExInstance } from './protocol';

declare global {
  interface Window {
    ___EXCALIBUR_DEVTOOL?: Engine;
    ___EXCALIBUR_DEVTOOL_EXTENSION_TESTCLOCK?: boolean;
    ___EXCALIBUR_DEVTOOL_EXTENSION_MATERIAL_ID?: number;
  }
}

if (typeof browser == 'undefined') {
  // Chrome does not support the browser namespace yet.
  globalThis.browser = globalThis.chrome;
}

/**
 * Detects an Excalibur instance in the current frame; returns label info for
 * the instance picker or null when the frame has no game.
 */
function detectExcalibur() {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return null;
  }
  return {
    title: document.title || '',
    url: location.href,
    version: window.___EXCALIBUR_DEVTOOL.version || '???'
  };
}

/**
 * Steps the clock forwarding the amount of milliseconds passed.
 */
function stepClock(stepMs: number) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
  }


  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  try {
    (game.clock as TestClock).step(stepMs);
  } catch {
    // only works on test clock
  }
}

/**
 * Stops the clock.
 */
function stopClock() {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
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
    return;
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
function kill(actorId: number) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  const actor = game.currentScene.world.entityManager.getById(actorId) as { kill(): void } | undefined;
  actor?.kill();
}

/**
 * Identifies an actor.
 */
function identifyEntity(entityId: number) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  const actor = game.currentScene.world.entityManager.getById(entityId) as { actions: { repeat(fn: (ctx: { fade(opacity: number, duration: number): void }) => void, times: number): void } } | undefined;
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
function setColorBlind(colorBlindMode: string) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  if (colorBlindMode === 'Normal') {
    game.debug.colorBlindMode.clear();
  } else {
    game.debug.colorBlindMode.simulate(colorBlindMode as Parameters<typeof game.debug.colorBlindMode.simulate>[0]);
  }
}

/**
 * Go to scene
 */
function goToScene(sceneName: string) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
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
function updatePhysics(settings: { config: Record<string, unknown> }) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
  }


  /**
  * Performs a deep merge of objects and returns mutated first object. 
  *
  * @param {...object} objects - Objects to merge
  * @returns {object} New object with merged key/values
  */
  function mergeDeep(...objects: Record<string, unknown>[]) {
    const isObject = (obj: unknown) => obj && typeof obj === 'object';

    return objects.reduce((prev, obj) => {
      Object.keys(obj).forEach(key => {
        const pVal = prev[key];
        const oVal = obj[key];
        if (Array.isArray(pVal) && Array.isArray(oVal)) {
          prev[key] = pVal.concat(...oVal);
        }
        else if (isObject(pVal) && isObject(oVal)) {
          prev[key] = mergeDeep(pVal as Record<string, unknown>, oVal as Record<string, unknown>);
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
  (game as unknown as { physics: Record<string, unknown> }).physics = mergeDeep(game.physics as unknown as Record<string, unknown>, settings.config);
}

/**
 * Updates a single uniform value (or the material color) on a material.
 *
 * Values arrive as JSON (numbers/booleans/number arrays); vectors and matrices
 * are assigned as Float32Array built in the page realm so the engine's
 * `instanceof Float32Array` uniform dispatch applies them by GL type.
 */
function updateMaterialUniform(update: {
  materialId: number;
  materialName: string;
  uniformName: string;
  kind: 'float' | 'int' | 'bool' | 'floatArray' | 'color';
  value: number | boolean | number[] | { r: number; g: number; b: number; a: number };
}) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyGame = game as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findMaterial(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidates: any[] = [];
    if (Array.isArray(anyGame.graphicsContext?.materials)) {
      candidates.push(...anyGame.graphicsContext.materials);
    } else {
      const sceneInstances = Object.keys(anyGame.scenes ?? {}).map((key) => anyGame.scenes[key]);
      sceneInstances.push(anyGame.currentScene);
      for (const scene of sceneInstances) {
        if (!scene || !scene.entities) {
          continue;
        }
        for (const entity of scene.entities) {
          if (typeof entity.getComponents !== 'function') {
            continue;
          }
          for (const component of entity.getComponents()) {
            if (component.material && typeof component.material.getShader === 'function') {
              candidates.push(component.material);
            }
          }
        }
      }
    }
    return (
      candidates.find((m) => m && (m.id === update.materialId || m.__exDevtoolsId === update.materialId)) ??
      candidates.find((m) => m && m.name === update.materialName)
    );
  }

  const material = findMaterial();
  if (!material) {
    return;
  }

  if (update.kind === 'color') {
    // u_color is not in the uniforms dictionary; it is applied from
    // material.color on every use(), so mutate the color in place
    const color = update.value as { r: number; g: number; b: number; a: number };
    if (material.color) {
      material.color.r = color.r;
      material.color.g = color.g;
      material.color.b = color.b;
      material.color.a = color.a;
    }
    return;
  }

  const shader = material.getShader();
  if (!shader || !shader.compiled) {
    return;
  }
  // the engine silently drops unknown uniform names (drivers optimize unused ones away)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!shader.getUniformDefinitions().some((def: any) => def.name === update.uniformName)) {
    return;
  }

  if (update.kind === 'floatArray') {
    material.uniforms[update.uniformName] = new Float32Array(update.value as number[]);
  } else if (update.kind === 'bool') {
    material.uniforms[update.uniformName] = !!update.value;
  } else {
    material.uniforms[update.uniformName] = Number(update.value);
  }
}

/**
 * Fetches the heavy per-material payload on demand: full shader sources and
 * texture thumbnails (as data urls).
 */
function getMaterialDetail(query: { materialId: number; materialName: string }) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return JSON.stringify(null);
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyGame = game as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findMaterial(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidates: any[] = [];
    if (Array.isArray(anyGame.graphicsContext?.materials)) {
      candidates.push(...anyGame.graphicsContext.materials);
    } else {
      const sceneInstances = Object.keys(anyGame.scenes ?? {}).map((key) => anyGame.scenes[key]);
      sceneInstances.push(anyGame.currentScene);
      for (const scene of sceneInstances) {
        if (!scene || !scene.entities) {
          continue;
        }
        for (const entity of scene.entities) {
          if (typeof entity.getComponents !== 'function') {
            continue;
          }
          for (const component of entity.getComponents()) {
            if (component.material && typeof component.material.getShader === 'function') {
              candidates.push(component.material);
            }
          }
        }
      }
    }
    return (
      candidates.find((m) => m && (m.id === query.materialId || m.__exDevtoolsId === query.materialId)) ??
      candidates.find((m) => m && m.name === query.materialName)
    );
  }

  const material = findMaterial();
  if (!material) {
    return JSON.stringify(null);
  }

  const id = typeof material.id === 'number' ? material.id : material.__exDevtoolsId ?? 0;
  const shader = material.getShader();
  const vertexSource: string = shader?.vertexSource ?? '';
  const fragmentSource: string = shader?.fragmentSource ?? '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textures: any[] = [];

  // default filtering/wrapping the TextureLoader applies when an image source
  // doesn't specify its own (statics on the TextureLoader class)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loaderCtor: any = anyGame.graphicsContext?.textureLoader?.constructor;
  const defaultFiltering: string | null = loaderCtor?.filtering ?? null;
  const defaultWrapX: string | null = loaderCtor?.wrapping?.x ?? null;
  const defaultWrapY: string | null = loaderCtor?.wrapping?.y ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addTexture = (sampler: string, imageSource: any) => {
    let dataUrl: string | null = null;
    let width = 0;
    let height = 0;
    let label = '';
    let filtering: string | null = null;
    let wrapX: string | null = null;
    let wrapY: string | null = null;
    try {
      const imageEl = imageSource?.image;
      width = imageEl?.naturalWidth || imageSource?.width || 0;
      height = imageEl?.naturalHeight || imageSource?.height || 0;
      label = imageSource?.path || '';
      filtering = imageSource?.filtering ?? imageEl?.getAttribute?.('filtering') ?? defaultFiltering;
      wrapX = imageSource?.wrapping?.x ?? imageEl?.getAttribute?.('wrapping-x') ?? defaultWrapX;
      wrapY = imageSource?.wrapping?.y ?? imageEl?.getAttribute?.('wrapping-y') ?? defaultWrapY;
      if (imageEl && width > 0 && height > 0) {
        const scale = Math.min(1, 1024 / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(imageEl, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL();
      }
    } catch {
      // tainted canvas (cross-origin image) or unloaded image; panel falls back to a label
      dataUrl = null;
    }
    textures.push({ sampler, dataUrl, width, height, label, filtering, wrapX, wrapY });
  };

  // Synthesize the default u_graphic (bound per draw, never in material.images)
  // by resolving the current graphic of the first entity using this material
  if (!material.isOverridingGraphic) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let graphicSource: any = undefined;
    const sceneInstances = Object.keys(anyGame.scenes ?? {}).map((key) => anyGame.scenes[key]);
    sceneInstances.push(anyGame.currentScene);
    outer: for (const scene of sceneInstances) {
      if (!scene || !scene.entities) {
        continue;
      }
      for (const entity of scene.entities) {
        if (typeof entity.getComponents !== 'function') {
          continue;
        }
        for (const component of entity.getComponents()) {
          if (component.material === material) {
            const graphic = component.current;
            if (graphic?.image?.image) {
              graphicSource = graphic.image;
            } else if (graphic?.currentFrame?.graphic?.image?.image) {
              graphicSource = graphic.currentFrame.graphic.image;
            }
            if (graphicSource) {
              break outer;
            }
          }
        }
      }
    }
    if (graphicSource) {
      addTexture('u_graphic', graphicSource);
    }
  }

  const imageSources = material.images ?? {};
  for (const sampler of Object.keys(imageSources)) {
    addTexture(sampler, imageSources[sampler]);
  }

  return JSON.stringify({
    key: `${material.name ?? 'anonymous material'}#${id}`,
    vertexSource,
    fragmentSource,
    processedByGlslTag: fragmentSource.includes('// processed by the excalibur glsl tag'),
    textures
  });
}

/**
 * Injects settings defined by the devtool into the game. Information about
 * the game state is then returned from this function.
 *
 * @param {Object} settings - Flat settings object
 * @param {Object} mappings - Map of setting keys to game.debug.* paths
 */
function inject(settings: Record<string, unknown>, mappings: Record<string, string>) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return null;
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;

  // Micro re-implementation of ex-color
  class ColorLike {
    r: number;
    g: number;
    b: number;
    a: number;
    constructor({ r, g, b, a }: { r: number; g: number; b: number; a?: number }) {
      this.r = r;
      this.g = g;
      this.b = b;
      this.a = a != null && a != undefined ? a : 1;
    }
    clone(dest?: ColorLike) {
      const result = dest || new ColorLike({ r: this.r, g: this.g, b: this.b, a: this.a });
      result.r = this.r;
      result.g = this.g;
      result.b = this.b;
      result.a = this.a;
      return result;
    }
  }

  /**
   * Patch a value at a nested path in an existing object.
   * Silently skips if the path doesn't exist (safe for older Excalibur versions).
   */
  function patchByPath(obj: Record<string, unknown>, path: string, value: unknown) {
    const parts = path.split('.');
    let target = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (target[key] === undefined || target[key] === null) {
        return; // Path doesn't exist, skip
      }
      target = target[key] as Record<string, unknown>;
    }
    target[parts[parts.length - 1]] = value;
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

  // Apply all settings using the mappings
  for (const [key, path] of Object.entries(mappings)) {
    if (settings[key] === undefined) continue;
    
    let value = settings[key];
    
    // Convert color objects to ColorLike instances
    if (value && typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
      value = new ColorLike(value as { r: number; g: number; b: number; a?: number });
    }
    
    patchByPath(game as unknown as Record<string, unknown>, path, value);
  }

  // Send game state to dev tools
  let currentScene = 'root';
  const sceneNames = [];
  for (const key of Object.keys(game.scenes)) {
    if (game.currentSceneName === key) {
      currentScene = key;
    }
    sceneNames.push(key);
  }

  const entities: Array<{
    id: number;
    name: string;
    ctor: string;
    pos: string;
    z: string;
    coordPlane: string;
    collisionType: string;
    collisionGroup: string;
    collisionMask: string;
    tags: string[];
  }> = [];
  for (const entity of game.currentScene.entities) {
    // one strange entity must never take down the whole heartbeat
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = entity as any;
      let pos = `(${e?.pos?.x?.toFixed(2)}, ${e?.pos?.y?.toFixed(2)})`;
      let z = `0`;
      let coordPlane = '';
      let collisionType = '';
      let collisionGroup = '';
      let collisionMask = '';
      for (const component of entity.getComponents()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = component as any;
        if (c.pos && c.coordPlane && c.z !== undefined) {
          pos = `(${c?.pos?.x?.toFixed(2)}, ${c?.pos?.y?.toFixed(2)})`;
          coordPlane = `${c?.coordPlane}`;
          z = `${c.z}`;
        }
        if (c.collisionType) {
          collisionType = c.collisionType;
          collisionGroup = c.group?.category ?? '';
          collisionMask = c.group?.mask ?? '';
        }
      }

      const tags = Array.from(entity.tags);
      entities.push({
        id: entity.id,
        name: entity.name,
        ctor: entity.constructor.name,
        pos: pos ?? 'none',
        z,
        coordPlane,
        collisionType,
        collisionGroup,
        collisionMask,
        tags
      });
    } catch {
      // skip entities that throw during inspection
    }
  }

  // Collect material/shader information, only while the Materials tab is visible
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let materials: { source: 'registry' | 'scan'; list: any[] } | undefined = undefined;
  if (settings.collectMaterials) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyGame = game as any;
      const gl: WebGL2RenderingContext | undefined = anyGame.graphicsContext?.__gl;

      const glTypeName = (glType: number): string => {
        if (!gl) {
          return 'unknown';
        }
        switch (glType) {
          case gl.FLOAT: return 'float';
          case gl.FLOAT_VEC2: return 'vec2';
          case gl.FLOAT_VEC3: return 'vec3';
          case gl.FLOAT_VEC4: return 'vec4';
          case gl.INT: return 'int';
          case gl.INT_VEC2: return 'ivec2';
          case gl.INT_VEC3: return 'ivec3';
          case gl.INT_VEC4: return 'ivec4';
          case gl.UNSIGNED_INT: return 'uint';
          case gl.BOOL: return 'bool';
          case gl.BOOL_VEC2: return 'bvec2';
          case gl.BOOL_VEC3: return 'bvec3';
          case gl.BOOL_VEC4: return 'bvec4';
          case gl.FLOAT_MAT2: return 'mat2';
          case gl.FLOAT_MAT3: return 'mat3';
          case gl.FLOAT_MAT4: return 'mat4';
          case gl.SAMPLER_2D: return 'sampler2D';
          case gl.SAMPLER_3D: return 'sampler3D';
          case gl.SAMPLER_CUBE: return 'samplerCube';
          case gl.SAMPLER_2D_ARRAY: return 'sampler2DArray';
          default: return `0x${glType.toString(16)}`;
        }
      };

      const hashSource = (str: string): number => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return hash;
      };

      // Registry ids (newer engines) win; otherwise tag materials with a page-session-stable id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getMaterialId = (material: any): number => {
        if (typeof material.id === 'number') {
          return material.id;
        }
        if (material.__exDevtoolsId === undefined) {
          window.___EXCALIBUR_DEVTOOL_EXTENSION_MATERIAL_ID = (window.___EXCALIBUR_DEVTOOL_EXTENSION_MATERIAL_ID ?? 0) + 1;
          material.__exDevtoolsId = window.___EXCALIBUR_DEVTOOL_EXTENSION_MATERIAL_ID;
        }
        return material.__exDevtoolsId;
      };

      let source: 'registry' | 'scan' = 'scan';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seen = new Set<any>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const collect = (material: any) => {
        if (material && typeof material.getShader === 'function' && !seen.has(material)) {
          seen.add(material);
          found.push(material);
        }
      };

      // Resolves the ImageSource behind a graphic (Sprite directly, Animation via its current frame)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resolveGraphicImageSource = (graphic: any): any => {
        if (!graphic) {
          return undefined;
        }
        if (graphic.image?.image) {
          return graphic.image;
        }
        const frameGraphic = graphic.currentFrame?.graphic;
        if (frameGraphic?.image?.image) {
          return frameGraphic.image;
        }
        return undefined;
      };

      // Walk entities once: discovers materials (scan fallback) and resolves
      // which entity graphic feeds u_graphic for each material. The scenes map
      // can also hold uninstantiated constructors/lazy loaders, so duck-type
      // for entities.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const materialToGraphicSource = new Map<any, any>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scannedMaterials: any[] = [];
      const sceneInstances = Object.keys(anyGame.scenes ?? {}).map((key) => anyGame.scenes[key]);
      sceneInstances.push(anyGame.currentScene);
      for (const scene of sceneInstances) {
        if (!scene || !scene.entities) {
          continue;
        }
        for (const entity of scene.entities) {
          if (typeof entity.getComponents !== 'function') {
            continue;
          }
          for (const component of entity.getComponents()) {
            const material = component.material;
            if (material && typeof material.getShader === 'function') {
              scannedMaterials.push(material);
              if (!materialToGraphicSource.has(material)) {
                const imageSource = resolveGraphicImageSource(component.current);
                if (imageSource) {
                  materialToGraphicSource.set(material, imageSource);
                }
              }
            }
          }
        }
      }

      if (Array.isArray(anyGame.graphicsContext?.materials)) {
        source = 'registry';
        for (const material of anyGame.graphicsContext.materials) {
          collect(material);
        }
      } else {
        for (const material of scannedMaterials) {
          collect(material);
        }
      }

      const builtInFallback = [
        'u_time_ms', 'u_opacity', 'u_resolution', 'u_graphic_resolution',
        'u_size', 'u_matrix', 'u_transform', 'u_graphic', 'u_screen_texture'
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list: any[] = [];
      for (const material of found) {
        try {
          const id = getMaterialId(material);
          const shader = material.getShader();
          const compiled = !!shader?.compiled;
          const builtIns: string[] = (material.constructor?.BuiltInUniforms ?? builtInFallback).concat(['u_color']);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const uniforms: any[] = [];
          if (compiled && gl) {
            for (const def of shader.getUniformDefinitions()) {
              const typeName = glTypeName(def.glType);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              let value: any = null;
              try {
                const raw = gl.getUniform(shader.program, def.location);
                if (raw instanceof Float32Array || raw instanceof Int32Array || raw instanceof Uint32Array) {
                  value = Array.from(raw);
                } else if (typeof raw === 'number' || typeof raw === 'boolean') {
                  value = raw;
                } else if (Array.isArray(raw)) {
                  value = raw;
                }
              } catch {
                value = null;
              }
              const builtIn = builtIns.includes(def.name);
              uniforms.push({
                name: def.name,
                typeName,
                builtIn,
                editable: !builtIn && ['float', 'int', 'uint', 'bool', 'vec2', 'vec3', 'vec4'].includes(typeName),
                value
              });
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const images: any[] = [];

          // resolves the sampling modes actually applied at texture upload:
          // explicit ImageSource options, then image element attributes, then
          // the TextureLoader class defaults
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const resolveSampling = (imageSource: any) => {
            let filtering: string | null = null;
            let wrapX: string | null = null;
            let wrapY: string | null = null;
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const loaderCtor: any = anyGame.graphicsContext?.textureLoader?.constructor;
              const imageEl = imageSource?.image;
              filtering = imageSource?.filtering ?? imageEl?.getAttribute?.('filtering') ?? loaderCtor?.filtering ?? null;
              wrapX = imageSource?.wrapping?.x ?? imageEl?.getAttribute?.('wrapping-x') ?? loaderCtor?.wrapping?.x ?? null;
              wrapY = imageSource?.wrapping?.y ?? imageEl?.getAttribute?.('wrapping-y') ?? loaderCtor?.wrapping?.y ?? null;
            } catch {
              // image may throw when unloaded
            }
            return { filtering, wrapX, wrapY };
          };

          // u_graphic and u_screen_texture are bound per draw call and never
          // appear in material.images, so synthesize entries for them
          if (!material.isOverridingGraphic) {
            const graphicSource = materialToGraphicSource.get(material);
            let width = 0;
            let height = 0;
            let loaded = false;
            let label = '(bound per draw)';
            try {
              if (graphicSource) {
                loaded = typeof graphicSource.isLoaded === 'function' ? graphicSource.isLoaded() : true;
                width = graphicSource.image?.naturalWidth || graphicSource.width || 0;
                height = graphicSource.image?.naturalHeight || graphicSource.height || 0;
                label = graphicSource.path || graphicSource.image?.src || '';
                if (label.startsWith('data:')) {
                  label = label.slice(0, 40) + '…';
                }
              }
            } catch {
              // image may throw when unloaded
            }
            const sampling = graphicSource ? resolveSampling(graphicSource) : { filtering: null, wrapX: null, wrapY: null };
            images.push({ sampler: 'u_graphic', slot: 0, builtIn: true, width, height, loaded, label, ...sampling });
          }
          if (material.isUsingScreenTexture) {
            images.push({
              sampler: 'u_screen_texture',
              slot: 1,
              builtIn: true,
              width: anyGame.graphicsContext?.width ?? 0,
              height: anyGame.graphicsContext?.height ?? 0,
              loaded: true,
              label: '(screen)'
            });
          }

          const imageSources = material.images ?? {};
          for (const sampler of Object.keys(imageSources)) {
            const imageSource = imageSources[sampler];
            let width = 0;
            let height = 0;
            let loaded = false;
            let label = '';
            try {
              loaded = typeof imageSource.isLoaded === 'function' ? imageSource.isLoaded() : true;
              width = imageSource.image?.naturalWidth || imageSource.width || 0;
              height = imageSource.image?.naturalHeight || imageSource.height || 0;
              label = imageSource.path || imageSource.image?.src || '';
              if (label.startsWith('data:')) {
                label = label.slice(0, 40) + '…';
              }
            } catch {
              // image may throw when unloaded
            }
            // an overriding image occupies the built-in u_graphic slot
            const builtIn = sampler === 'u_graphic';
            images.push({
              sampler,
              slot: builtIn ? 0 : undefined,
              builtIn,
              width,
              height,
              loaded,
              label,
              ...resolveSampling(imageSource)
            });
          }

          const vertexSource = shader?.vertexSource ?? '';
          const fragmentSource = shader?.fragmentSource ?? '';
          list.push({
            id,
            name: material.name ?? 'anonymous material',
            key: `${material.name ?? 'anonymous material'}#${id}`,
            color: material.color ? { r: material.color.r, g: material.color.g, b: material.color.b, a: material.color.a } : null,
            isUsingScreenTexture: !!material.isUsingScreenTexture,
            isOverridingGraphic: !!material.isOverridingGraphic,
            compiled,
            sourceHash: hashSource(vertexSource + fragmentSource),
            uniforms,
            images
          });
        } catch {
          // never let one bad material break the heartbeat
        }
      }
      materials = { source, list };
    } catch {
      materials = { source: 'scan', list: [] };
    }
  }

  // _originalOptions is a private engine field; guard for versions without it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {scenes: _, ...config } = (game as any)._originalOptions ?? {};

  // scene.physics is missing on older engines; never let it kill the payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const physicsConfig = (game.currentScene as any)?.physics?.config;

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
      strategies: game.currentScene.camera?.strategies?.map((s: { constructor: { name: string } }) => ({ name: s.constructor.name }))
    },
    currentScene: currentScene,
    scenes: sceneNames,
    pointer: {
      worldPos: game.input.pointers?.primary?.lastWorldPos,
      screenPos: game.input.pointers?.primary?.lastScreenPos,
      pagePos: game.input.pointers?.primary?.lastPagePos
    },
    entities: entities,
    materials: materials,
    stats: game.debug?.stats,
    physics: {
      enabled: !!game.physics?.enabled,
      maxFps: game.maxFps,
      fixedUpdateFps: game.fixedUpdateFps,
      fixedUpdateTimestep: game.fixedUpdateTimestep,
      gravity: physicsConfig?.gravity ?? { _x: 0, _y: 0 },
      solverStrategy: physicsConfig?.solver ?? 'arcade',
      config: { ...(physicsConfig ?? {}) }
    }
  });
}

/**
 *  Creates the default debug settings for a panel connection. Each connection
 *  gets its own copy so panels on different tabs never share state and a
 *  closed panel's settings (e.g. collectMaterials) can't leak into the next.
 *  @typedef {import('./components/debug-settings').Settings DebugSettings
 *  @type DebugSettings
 */
const createDefaultDebugSettings = () => ({
  toggleDebug: false,
  // Not part of settingsMappings so it is never patched onto the game;
  // gates material collection to when the Materials tab is visible
  collectMaterials: false,
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

  showZIndex: false,

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
});

/**
 * Runs an injected function in a specific frame (default top frame) of a tab,
 * swallowing rejections from non-injectable targets (chrome:// pages, dead tabs).
 */
function execInFrame(
  tabId: number,
  frameId: number | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  func: (...fnArgs: any[]) => unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: any[]
) {
  return globalThis.browser.scripting
    .executeScript({
      target: { tabId, frameIds: [frameId ?? 0] },
      world: 'MAIN',
      func,
      args
    })
    .catch((e) => {
      console.info('executeScript failed:', e);
      return [] as chrome.scripting.InjectionResult[];
    });
}

globalThis.browser.runtime.onConnect.addListener((port) => {
  console.info('Connected:', port.name);

  // Per-connection state: which tab the panel inspects (from the hello
  // handshake) and which frame's Excalibur instance is selected
  const state: { tabId: number | null; selectedFrameId: number | null } = {
    tabId: null,
    selectedFrameId: null
  };

  // Per-connection settings: panels on different tabs must not share state
  const debugSettings = createDefaultDebugSettings();

  let disconnected = false;

  /**
   * Posts to the panel unless the port is already gone; async work (the
   * heartbeat, command replies) can resolve after the panel closes.
   */
  const safePostMessage = (message: object) => {
    if (disconnected) {
      return;
    }
    try {
      port.postMessage(message);
    } catch {
      disconnected = true;
    }
  };

  port.onMessage.addListener((message) => {
    console.info('Received message:', message);

    // https://parceljs.org/recipes/web-extension/#unexpected-messages
    if (message.__parcel_hmr_reload__) {
      return;
    }

    if (message.name === 'ex-debug:hello') {
      state.tabId = message.tabId;
      return;
    }

    if (message.name === 'ex-debug:command') {
      switch (message.dispatch) {
        case 'ex-debug:select-frame':
          {
            state.selectedFrameId = message.frameId;
          }
          break;
        case 'ex-debug:toggle-test-clock':
          {
            execInFrame(message.tabId, state.selectedFrameId, toggleTestClock);
          }
          break;
        case 'ex-debug:step-clock':
          {
            execInFrame(message.tabId, state.selectedFrameId, stepClock, [message.stepMs]);
          }
          break;
        case 'ex-debug:start-clock':
          {
            execInFrame(message.tabId, state.selectedFrameId, startClock);
          }
          break;
        case 'ex-debug:stop-clock':
          {
            execInFrame(message.tabId, state.selectedFrameId, stopClock);
          }
          break;
        case 'ex-debug:kill':
          {
            execInFrame(message.tabId, state.selectedFrameId, kill, [message.actorId]);
          }
          break;
        case "ex-debug:color-blind":
          {
            execInFrame(message.tabId, state.selectedFrameId, setColorBlind, [message.colorBlindMode]);
          }
          break;
        case "ex-debug:goto-scene":
          {
            execInFrame(message.tabId, state.selectedFrameId, goToScene, [message.sceneName]);
          }
          break;
        case "ex-debug:identify-actor":
          {
            execInFrame(message.tabId, state.selectedFrameId, identifyEntity, [message.actorId]);
          }
          break;
        case 'ex-debug:toggle-debug':
          {
            debugSettings.toggleDebug = !debugSettings.toggleDebug;
          }
          break;
        case 'ex-debug:update-debug':
          {
            // Simply merge all settings from the message
            Object.assign(debugSettings, message.debug);
          }
          break;
        case 'ex-debug:update-physics':
          {
            execInFrame(message.tabId, state.selectedFrameId, updatePhysics, [message.physics]);
          }
          break;
        case 'ex-debug:materials-active':
          {
            debugSettings.collectMaterials = !!message.active;
          }
          break;
        case 'ex-debug:update-material-uniform':
          {
            execInFrame(message.tabId, state.selectedFrameId, updateMaterialUniform, [message.update]);
          }
          break;
        case 'ex-debug:get-material-detail':
          {
            execInFrame(message.tabId, state.selectedFrameId, getMaterialDetail, [
              { materialId: message.materialId, materialName: message.materialName }
            ]).then((results) => {
              safePostMessage({
                name: 'ex-debug:material-detail',
                data: results?.[0]?.result ?? null
              });
            }).catch((e) => {
              console.info('material detail reply failed:', e);
            });
          }
          break;
        default:
          console.info('Unhandled dispatch:', message.dispatch);
          break;
      }
    }
  });

  safePostMessage({
    name: 'ex-debug:init',
    data: {
      settings: debugSettings
    }
  });

  // Poll the inspected tab every 200ms once the panel has said hello
  const intervalId = setInterval(async () => {
    const tabId = state.tabId;
    if (tabId === null) {
      return;
    }
    try {
      const detected = await globalThis.browser.scripting.executeScript({
        target: { tabId, allFrames: true },
        world: 'MAIN',
        func: detectExcalibur
      });
      const instances: ExInstance[] = [];
      for (const frame of detected) {
        if (frame && frame.result) {
          instances.push({ frameId: frame.frameId, ...frame.result });
        }
      }
      // Reconcile the selection: keep it while its frame still has a game,
      // otherwise prefer the top frame, then the first instance found
      if (!instances.some((i) => i.frameId === state.selectedFrameId)) {
        state.selectedFrameId = instances.some((i) => i.frameId === 0)
          ? 0
          : instances.length > 0
            ? instances[0].frameId
            : null;
      }
      let data: string | null = null;
      if (state.selectedFrameId !== null) {
        const gameState = await globalThis.browser.scripting.executeScript({
          target: { tabId, frameIds: [state.selectedFrameId] },
          world: 'MAIN',
          func: inject,
          args: [debugSettings, settingsMappings]
        });
        data = gameState[0]?.result ?? null;
      }
      safePostMessage({
        name: 'ex-debug:heartbeat',
        instances,
        selectedFrameId: state.selectedFrameId,
        data
      });
    } catch {
      // Non-injectable target (chrome:// page, dead tab) — tell the panel
      // there is nothing here rather than leaving it hanging
      safePostMessage({
        name: 'ex-debug:heartbeat',
        instances: [],
        selectedFrameId: null,
        data: null
      });
    }
  }, 200);

  port.onDisconnect.addListener(() => {
    console.info('Disconnected:', port.name);
    disconnected = true;
    clearInterval(intervalId);
  });
});
