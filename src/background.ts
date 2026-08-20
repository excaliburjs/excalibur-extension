import { DefaultSettings, settingsMappings } from './settings/schema';
import type { Engine, TestClock } from './@types/excalibur';
import type { ExInstance } from './protocol';

declare global {
  interface Window {
    ___EXCALIBUR_DEVTOOL?: Engine;
    ___EXCALIBUR_DEVTOOL_EXTENSION_TESTCLOCK?: boolean;
    ___EXCALIBUR_DEVTOOL_EXTENSION_MATERIAL_ID?: number;
    ___EXCALIBUR_DEVTOOL_EXTENSION_PICKER?: {
      seq: number;
      pickedId: number | null;
      hovered: { id: number; name: string; ctor: string } | null;
      teardown: () => void;
    };
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
  const actor = game.currentScene.world.entityManager.getById(entityId) as {
    actions: {
      repeat(fn: (ctx: { fade(opacity: number, duration: number): void }) => void, times: number): void;
    };
  } | undefined;
  if (actor === undefined) {
    throw new Error(`No entity found for id ${entityId}`)
  }
  actor.actions.repeat((context) => {
    context.fade(0, 200);
    context.fade(1, 200);
  }, 3);
}

/**
 * Installs the page-side entity picker: capture-phase pointer listeners, a
 * DOM highlight overlay, and a rAF loop that re-projects the highlight as
 * the camera or entities move under a stationary cursor. Hit-testing mirrors
 * the engine's own PointerSystem algorithm using only public API
 * (physics.query + collider.contains, plus GraphicsComponent world bounds —
 * which already handle CoordPlane.Screen via the camera inverse) so it never
 * touches version-fragile internals. Pick clicks on the canvas are swallowed
 * before the engine's own listeners see them. Results are left on
 * window.___EXCALIBUR_DEVTOOL_EXTENSION_PICKER for the heartbeat to read;
 * Escape and stopEntityPicker share the teardown stored there. Idempotent.
 */
function startEntityPicker() {
  if (window.___EXCALIBUR_DEVTOOL_EXTENSION_PICKER) {
    return;
  }
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;

  const state: NonNullable<Window['___EXCALIBUR_DEVTOOL_EXTENSION_PICKER']> = {
    seq: 0,
    pickedId: null,
    hovered: null,
    teardown: () => {
      // replaced with the real teardown once listeners are installed
    }
  };

  // Highlight rect + name chip, positioned in page coordinates so scroll,
  // canvas CSS scaling, and pixelRatio are all handled by the engine's
  // world->page projection
  const highlight = document.createElement('div');
  highlight.style.cssText =
    'position:absolute;pointer-events:none;z-index:2147483647;' +
    'background:rgba(255,213,46,0.15);box-sizing:border-box;display:none;';

  const label = document.createElement('div');
  label.style.cssText =
    'position:absolute;left:0;top:-22px;padding:2px 6px;background:#222;' +
    'color:#ffd52e;font:11px monospace;border-radius:3px;white-space:nowrap;';

  highlight.appendChild(label);
  document.body.appendChild(highlight);

  const canvas = game.canvas as HTMLCanvasElement | undefined;
  const priorCursor = canvas ? canvas.style.cursor : '';
  if (canvas) {
    canvas.style.cursor = 'crosshair';
  }

  // Magic to grab a vector ctor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scratchVec: any = null;
  try {
    scratchVec = game.currentScene.camera.pos.clone();
  } catch {
    scratchVec = null;
  }

  const makeVec = (x: number, y: number) => {
    if (scratchVec) {
      scratchVec.x = x;
      scratchVec.y = y;
      return scratchVec;
    }
    return { x, y };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getEntityZ = (entity: any): number => {
    if (typeof entity.z === 'number') {
      return entity.z;
    }
    try {
      for (const c of entity.getComponents()) {
        if (c.pos && c.coordPlane && c.z !== undefined) {
          return c.z;
        }
      }
    } catch { }

    return -Infinity;
  };

  const pickAt = (pageX: number, pageY: number) => {
    try {
      const scene = game.currentScene;
      if (!scene) {
        return null;
      }
      const worldVec =
        game.screen && typeof game.screen.pageToWorldCoordinates === 'function'
          ? game.screen.pageToWorldCoordinates(makeVec(pageX, pageY))
          : game.input?.pointers?.primary?.lastWorldPos;
      if (!worldVec) {
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hits = new Map<number, any>();
      try {
        if (scene.physics && typeof scene.physics.query === 'function') {
          for (const collider of scene.physics.query(worldVec) ?? []) {
            const owner = collider?.owner;
            if (!owner || (typeof owner.isKilled === 'function' && owner.isKilled())) {
              continue;
            }
            if (typeof collider.contains === 'function' && !collider.contains(worldVec)) {
              continue;
            }
            hits.set(owner.id, owner);
          }
        }
      } catch { }

      try {
        for (const entity of scene.entities ?? []) {
          if (hits.has(entity.id) || (typeof entity.isKilled === 'function' && entity.isKilled())) {
            continue;
          }
          try {
            if ((entity as any).graphics) {
              const bounds = (entity as any).graphics?.bounds;
              if (bounds && typeof bounds.contains === 'function' && bounds.contains(worldVec)) {
                hits.set(entity.id, entity);
              }
            }
          } catch { }
        }
      } catch { }

      if (hits.size === 0) {
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let top: any = null;
      let topZ = -Infinity;
      for (const entity of hits.values()) {
        const z = getEntityZ(entity);
        if (top === null || z > topZ || (z === topZ && entity.id > top.id)) {
          top = entity;
          topZ = z;
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bounds: any = null;
      try {
        bounds = top.graphics?.bounds ?? null;
      } catch {
        bounds = null;
      }
      if (!bounds) {
        try {
          bounds = top.collider?.bounds ?? null;
        } catch {
          bounds = null;
        }
      }
      return {
        id: top.id as number,
        name: String(top.name ?? ''),
        ctor: String(top.constructor?.name ?? ''),
        bounds
      };
    } catch {
      return null;
    }
  };

  /**
   * Positions the highlight over the hovered entity's bounds; on engines
   * without worldToPageCoordinates, degrades to a cursor-adjacent label.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const positionOverlay = (hovered: any, pageX: number, pageY: number) => {
    if (!hovered) {
      highlight.style.display = 'none';
      return;
    }
    label.textContent = `${hovered.name} | ${hovered.ctor} #${hovered.id}`;
    if (hovered.bounds &&
        scratchVec &&
        game.screen &&
        typeof game.screen.worldToPageCoordinates === 'function') {

      try {
        const tl = game.screen.worldToPageCoordinates(makeVec(hovered.bounds.left, hovered.bounds.top));
        const br = game.screen.worldToPageCoordinates(makeVec(hovered.bounds.right, hovered.bounds.bottom));
        highlight.style.left = `${Math.min(tl.x, br.x)}px`;
        highlight.style.top = `${Math.min(tl.y, br.y)}px`;
        highlight.style.width = `${Math.abs(br.x - tl.x)}px`;
        highlight.style.height = `${Math.abs(br.y - tl.y)}px`;
        highlight.style.border = '1px solid #ffd52e';
        highlight.style.display = 'block';
        return;
      } catch {}
    }

    highlight.style.left = `${pageX + 14}px`;
    highlight.style.top = `${pageY + 14}px`;
    highlight.style.width = '0px';
    highlight.style.height = '0px';
    highlight.style.border = 'none';
    highlight.style.display = 'block';
  };

  let lastPageX = -1;
  let lastPageY = -1;

  /** Tracks the cursor and updates the hovered entity + highlight */
  const onMove = (e: PointerEvent) => {
    lastPageX = e.pageX;
    lastPageY = e.pageY;
    if (state.pickedId === null) {
      state.hovered = pickAt(e.pageX, e.pageY);
      positionOverlay(state.hovered, e.pageX, e.pageY);
    }
  };

  const swallow = (e: Event) => {
    if (canvas && e.target === canvas) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };

  const onDown = (e: PointerEvent) => {
    if (canvas && e.target === canvas) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (state.hovered) {
        state.pickedId = state.hovered.id;
        state.seq++;
        highlight.style.display = 'none';
      }
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      state.teardown();
    }
  };

  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointerup', swallow, true);
  window.addEventListener('click', swallow, true);
  window.addEventListener('keydown', onKey, true);

  let rafId = 0;
  const tick = () => {
    if (lastPageX >= 0 && state.pickedId === null) {
      state.hovered = pickAt(lastPageX, lastPageY);
      positionOverlay(state.hovered, lastPageX, lastPageY);
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  let tornDown = false;
  state.teardown = () => {
    if (tornDown) {
      return;
    }
    tornDown = true;
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('pointerup', swallow, true);
    window.removeEventListener('click', swallow, true);
    window.removeEventListener('keydown', onKey, true);
    cancelAnimationFrame(rafId);
    highlight.remove();
    if (canvas) {
      canvas.style.cursor = priorCursor;
    }
    window.___EXCALIBUR_DEVTOOL_EXTENSION_PICKER = undefined;
  };

  window.___EXCALIBUR_DEVTOOL_EXTENSION_PICKER = state;
}

function stopEntityPicker() {
  const picker = window.___EXCALIBUR_DEVTOOL_EXTENSION_PICKER;
  if (picker && typeof picker.teardown === 'function') {
    try {
      picker.teardown();
    } catch {}
  }
  window.___EXCALIBUR_DEVTOOL_EXTENSION_PICKER = undefined;
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
        } else if (isObject(pVal) && isObject(oVal)) {
          prev[key] = mergeDeep(pVal as Record<string, unknown>, oVal as Record<string, unknown>);
        } else {
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

  /** Resolves the target material by registry/devtools id, falling back to name. */
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
 * Fetches the heavy graphics payload for the inspected entity on demand:
 * graphics available on its GraphicsComponent plus the Serializer global
 * graphics registry (when the page exposes `window.ex`), with thumbnails.
 */
function getEntityGraphics(query: { entityId: number }) {
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

  const entity = anyGame.currentScene?.world?.entityManager?.getById?.(query.entityId);
  if (!entity || typeof entity.getComponents !== 'function') {
    return JSON.stringify(null);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let graphicsComp: any = null;
  for (const c of entity.getComponents()) {
    if (typeof c.use === 'function' && c.anchor !== undefined) {
      graphicsComp = c;
      break;
    }
  }

  /** Draws a source region scaled into a capped offscreen canvas. */
  const draw = (source: CanvasImageSource, sx: number, sy: number, sw: number, sh: number) => {
    if (!(sw > 0) || !(sh > 0)) {
      return { width: 0, height: 0, dataUrl: null as string | null };
    }
    const scale = Math.min(1, 128 / Math.max(sw, sh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return { width: Math.round(sw), height: Math.round(sh), dataUrl: canvas.toDataURL() as string | null };
  };

  /**
   * Renders a thumbnail for a graphic, resolving nested types (Animation via
   * its first frame, GraphicsGroup via its first member); null dataUrl on
   * tainted canvases, unloaded images, or unknown graphic shapes.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const thumbnail = (graphic: any, depth: number): { width: number; height: number; dataUrl: string | null } => {
    if (!graphic || depth > 3) {
      return { width: 0, height: 0, dataUrl: null };
    }
    try {
      // Raster subclasses (Rectangle, Circle, Text, ...) hold a backing canvas
      if (graphic._bitmap && typeof graphic._bitmap.getContext === 'function') {
        const bitmap = graphic._bitmap as HTMLCanvasElement;
        return draw(bitmap, 0, 0, bitmap.width, bitmap.height);
      }
      // Sprite: crop its sourceView from the backing image element
      const imageEl = graphic.image?.image;
      if (imageEl) {
        const sourceView = graphic.sourceView;
        if (sourceView && sourceView.width > 0 && sourceView.height > 0) {
          return draw(imageEl, sourceView.x || 0, sourceView.y || 0, sourceView.width, sourceView.height);
        }
        return draw(imageEl, 0, 0, imageEl.naturalWidth || 0, imageEl.naturalHeight || 0);
      }
      // Animation: use the first frame's graphic
      if (Array.isArray(graphic.frames) && graphic.frames.length > 0) {
        return thumbnail(graphic.frames[0]?.graphic, depth + 1);
      }
      // GraphicsGroup: use the first member
      if (Array.isArray(graphic.members) && graphic.members.length > 0) {
        const member = graphic.members[0];
        return thumbnail(member?.graphic ?? member, depth + 1);
      }
    } catch {
      // tainted canvas (cross-origin image) or unloaded image
    }
    return { width: Math.round(graphic.width || 0), height: Math.round(graphic.height || 0), dataUrl: null };
  };

  /** Builds one GraphicThumb entry, never letting one graphic break the payload. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const thumbFor = (name: string, graphic: any) => {
    let thumb: { width: number; height: number; dataUrl: string | null } = { width: 0, height: 0, dataUrl: null };
    try {
      thumb = thumbnail(graphic, 0);
    } catch {
      // keep the placeholder entry
    }
    return {
      name,
      type: graphic?.constructor?.name ?? 'Graphic',
      width: thumb.width,
      height: thumb.height,
      dataUrl: thumb.dataUrl
    };
  };

  const names: string[] = graphicsComp
    ? typeof graphicsComp.getNames === 'function'
      ? graphicsComp.getNames()
      : Object.keys(graphicsComp._graphics ?? {})
    : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const local: any[] = [];
  for (const name of names) {
    const graphic = typeof graphicsComp.getGraphic === 'function' ? graphicsComp.getGraphic(name) : graphicsComp._graphics?.[name];
    local.push(thumbFor(name, graphic));
  }
  const current: string = graphicsComp?._current ?? '';

  // The Serializer global graphics registry is only reachable when the page
  // exposes the ex namespace; reading it never requires Serializer.init()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serializer = (window as any).ex?.Serializer;
  const registryAvailable = !!(serializer && typeof serializer.getRegisteredGraphics === 'function' && typeof serializer.getGraphic === 'function');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registry: any[] = [];
  if (registryAvailable) {
    try {
      for (const id of serializer.getRegisteredGraphics()) {
        registry.push(thumbFor(id, serializer.getGraphic(id)));
      }
    } catch {
      // registry read failed; keep whatever was collected
    }
  }

  return JSON.stringify({
    entityId: query.entityId,
    graphicsKey: names.join(',') + '|' + current,
    current,
    local,
    registryAvailable,
    registry
  });
}

/**
 * Applies a single property write from the entity inspector. Resolves the
 * target component by duck-typing and only writes properties on an explicit
 * allowlist; silently no-ops when the entity/component/property is missing.
 */
function updateEntityProperty(update: {
  entityId: number;
  target: 'entity' | 'transform' | 'motion' | 'graphics' | 'body';
  property: string;
  kind: 'number' | 'boolean' | 'string' | 'vector';
  value: number | boolean | string | { x: number; y: number };
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
  try {
    const entity = anyGame.currentScene?.world?.entityManager?.getById?.(update.entityId);
    if (!entity) {
      return;
    }

    if (update.target === 'entity') {
      if (update.property === 'name' && typeof update.value === 'string') {
        entity.name = update.value;
      }
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let component: any = null;
    if (typeof entity.getComponents === 'function') {
      for (const c of entity.getComponents()) {
        if (
          (update.target === 'transform' && c.pos !== undefined && c.z !== undefined && c.coordPlane !== undefined) ||
          (update.target === 'motion' && c.vel !== undefined && c.acc !== undefined && c.angularVelocity !== undefined) ||
          (update.target === 'graphics' && typeof c.use === 'function' && c.anchor !== undefined) ||
          (update.target === 'body' && c.collisionType !== undefined && c.mass !== undefined)
        ) {
          component = c;
          break;
        }
      }
    }
    if (!component) {
      return;
    }

    /**
     * Writes a whole vector in place; setTo preserves the engine's watched
     * vector dirty-flagging, with direct axis assignment as fallback.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const writeVector = (vec: any, value: { x: number; y: number }) => {
      if (!vec) {
        return;
      }
      if (typeof vec.setTo === 'function') {
        vec.setTo(value.x, value.y);
      } else {
        vec.x = value.x;
        vec.y = value.y;
      }
    };

    // Allowlist of writable properties per target component
    const numberProps: Record<string, string[]> = {
      transform: ['rotation', 'z'],
      motion: ['angularVelocity', 'torque'],
      graphics: ['opacity'],
      body: ['mass', 'friction', 'bounciness']
    };
    const booleanProps: Record<string, string[]> = {
      graphics: ['isVisible', 'flipHorizontal', 'flipVertical'],
      body: ['useGravity']
    };
    const vectorProps: Record<string, string[]> = {
      transform: ['pos', 'scale'],
      motion: ['vel', 'acc'],
      graphics: ['offset', 'anchor']
    };

    if (update.kind === 'vector' && (vectorProps[update.target] ?? []).includes(update.property)) {
      const vector = update.value as { x: number; y: number };
      if (vector && Number.isFinite(vector.x) && Number.isFinite(vector.y)) {
        writeVector(component[update.property], vector);
        // in-place vector mutation bypasses the setter that normally
        // recalculates graphics bounds
        if (update.target === 'graphics' && typeof component.recalculateBounds === 'function') {
          component.recalculateBounds();
        }
      }
    } else if (update.kind === 'number' && (numberProps[update.target] ?? []).includes(update.property)) {
      const num = Number(update.value);
      if (Number.isFinite(num)) {
        component[update.property] = num;
      }
    } else if (update.kind === 'boolean' && (booleanProps[update.target] ?? []).includes(update.property)) {
      if (update.property === 'isVisible' && component.isVisible === undefined && component.visible !== undefined) {
        // pre-isVisible engines only have the `visible` property
        component.visible = !!update.value;
      } else {
        component[update.property] = !!update.value;
      }
    } else if (update.kind === 'string' && update.target === 'body' && update.property === 'collisionType') {
      if (['Active', 'Fixed', 'Passive', 'PreventCollision'].includes(String(update.value))) {
        component.collisionType = String(update.value);
      }
    }
  } catch {
    // never throw from injected code
  }
}

/**
 * Switches the current graphic of an entity's GraphicsComponent, either to a
 * graphic already on the component or to one from the Serializer global
 * graphics registry (added to the component first).
 */
function useEntityGraphic(query: { entityId: number; graphicName: string; source: 'local' | 'registry' }) {
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
  try {
    const entity = anyGame.currentScene?.world?.entityManager?.getById?.(query.entityId);
    if (!entity || typeof entity.getComponents !== 'function') {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let graphicsComp: any = null;
    for (const c of entity.getComponents()) {
      if (typeof c.use === 'function' && c.anchor !== undefined) {
        graphicsComp = c;
        break;
      }
    }
    if (!graphicsComp) {
      return;
    }
    if (query.source === 'registry') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serializer = (window as any).ex?.Serializer;
      const graphic = serializer && typeof serializer.getGraphic === 'function' ? serializer.getGraphic(query.graphicName) : undefined;
      if (!graphic || typeof graphicsComp.add !== 'function') {
        return;
      }
      graphicsComp.add(query.graphicName, graphic);
    }
    graphicsComp.use(query.graphicName);
  } catch {
    // never throw from injected code
  }
}

/**
 * Injects settings defined by the devtool into the game. Information about
 * the game state is then returned from this function.
 * @param {object} settings - Flat settings object
 * @param {object} mappings - Map of setting keys to game.debug.* paths
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
      this.a = a != null ? a : 1;
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
    if (settings[key] === undefined) {
      continue;
    }

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
        'u_time_ms', 
        'u_opacity',
        'u_resolution',
        'u_graphic_resolution',
        'u_size',
        'u_matrix',
        'u_transform',
        'u_graphic',
        'u_screen_texture'
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

  // Deep-serialize one entity, only while the inspector dialog is open.
  // undefined = not inspecting (dropped by JSON.stringify); null = entity gone
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let inspectedEntity: any = undefined;
  if (settings.inspectEntityId !== null && settings.inspectEntityId !== undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyGame = game as any;
      const entity = anyGame.currentScene?.world?.entityManager?.getById?.(settings.inspectEntityId as number);
      if (entity && typeof entity.getComponents === 'function') {
        /**
         * Makes serialized data JSON-safe: non-finite numbers become strings
         * ('Infinity' would otherwise stringify to null), depth capped at 4,
         * arrays capped at 50 entries, functions/unknowns dropped.
         */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sanitize = (value: any, depth: number): any => {
          if (value === null || value === undefined) {
            return null;
          }
          const valueType = typeof value;
          if (valueType === 'number') {
            return Number.isFinite(value) ? value : String(value);
          }
          if (valueType === 'string' || valueType === 'boolean') {
            return value;
          }
          if (valueType !== 'object' || depth >= 4) {
            return undefined;
          }
          if (Array.isArray(value)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const arr: any[] = [];
            for (let i = 0; i < value.length && i < 50; i++) {
              arr.push(sanitize(value[i], depth + 1));
            }
            return arr;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const out: Record<string, any> = {};
          for (const key of Object.keys(value)) {
            const sanitized = sanitize(value[key], depth + 1);
            if (sanitized !== undefined) {
              out[key] = sanitized;
            }
          }
          return out;
        };

        /** Duck-types a live component into an editor kind; never trusts names. */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const classify = (c: any): string => {
          if (c.pos !== undefined && c.z !== undefined && c.coordPlane !== undefined) {
            return 'transform';
          }
          if (c.vel !== undefined && c.acc !== undefined && c.angularVelocity !== undefined) {
            return 'motion';
          }
          if (typeof c.use === 'function' && c.anchor !== undefined) {
            return 'graphics';
          }
          if (c.collisionType !== undefined && c.mass !== undefined) {
            return 'body';
          }
          if (typeof c.useBoxCollider === 'function') {
            return 'collider';
          }
          return 'unknown';
        };

        /**
         * Reflection fallback for engines without Component.serialize()
         * (pre v0.33.0-alpha); hand-builds the same shapes serialize() emits.
         */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reflect = (c: any, kind: string): Record<string, any> => {
          if (kind === 'transform') {
            return {
              pos: { x: c.pos.x, y: c.pos.y },
              rotation: c.rotation,
              scale: { x: c.scale.x, y: c.scale.y },
              z: c.z,
              coordPlane: c.coordPlane
            };
          }
          if (kind === 'motion') {
            return {
              vel: { x: c.vel.x, y: c.vel.y },
              acc: { x: c.acc.x, y: c.acc.y },
              maxVel: c.maxVel ? { x: c.maxVel.x, y: c.maxVel.y } : undefined,
              angularVelocity: c.angularVelocity,
              torque: c.torque,
              inertia: c.inertia
            };
          }
          if (kind === 'graphics') {
            return {
              current: c._current ?? '',
              graphicRefs: Object.keys(c._graphics ?? {}),
              isVisible: c.isVisible !== undefined ? c.isVisible : c.visible,
              opacity: c.opacity,
              offset: c.offset ? { x: c.offset.x, y: c.offset.y } : undefined,
              anchor: c.anchor ? { x: c.anchor.x, y: c.anchor.y } : undefined,
              flipHorizontal: c.flipHorizontal,
              flipVertical: c.flipVertical
            };
          }
          if (kind === 'body') {
            return {
              collisionType: String(c.collisionType),
              mass: c.mass,
              friction: c.friction,
              bounciness: c.bounciness,
              useGravity: c.useGravity,
              canSleep: c.canSleep,
              collisionGroup: c.group?.name ?? ''
            };
          }
          if (kind === 'collider') {
            const collider = typeof c.get === 'function' ? c.get() : undefined;
            return {
              shape: collider?.constructor?.name ?? 'none',
              bounds: collider?.bounds
                ? { left: collider.bounds.left, top: collider.bounds.top, right: collider.bounds.right, bottom: collider.bounds.bottom }
                : undefined
            };
          }
          // best-effort own-property dump for unknown components
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const out: Record<string, any> = {};
          for (const key of Object.keys(c)) {
            if (key === 'owner' || key.indexOf('_') === 0 || typeof c[key] === 'function') {
              continue;
            }
            out[key] = c[key];
          }
          return out;
        };

        // getComponents() returns subclassed components under two Map keys
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const seenComponents = new Set<any>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const components: any[] = [];
        let usedSerialize = false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let graphicsComp: any = null;
        for (const c of entity.getComponents()) {
          if (seenComponents.has(c)) {
            continue;
          }
          seenComponents.add(c);
          const kind = classify(c);
          if (kind === 'graphics') {
            graphicsComp = c;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let componentData: Record<string, any> = {};
          let error = false;
          try {
            if (typeof c.serialize === 'function') {
              // v0.33.0-alpha+; works without Serializer.init()
              componentData = c.serialize();
              usedSerialize = true;
            } else {
              componentData = reflect(c, kind);
            }
          } catch {
            try {
              componentData = reflect(c, kind);
            } catch {
              error = true;
            }
          }
          components.push({
            type: c.constructor?.name ?? 'Component',
            kind,
            data: sanitize(componentData, 0) ?? {},
            error: error || undefined
          });
        }

        const graphicsNames: string[] = graphicsComp
          ? typeof graphicsComp.getNames === 'function'
            ? graphicsComp.getNames()
            : Object.keys(graphicsComp._graphics ?? {})
          : [];
        const graphicsCurrent: string = graphicsComp?._current ?? '';
        inspectedEntity = {
          id: entity.id,
          name: entity.name,
          ctor: entity.constructor.name,
          tags: Array.from(entity.tags ?? []),
          isKilled: !!(typeof entity.isKilled === 'function' && entity.isKilled()),
          parent: entity.parent ? { id: entity.parent.id, name: entity.parent.name } : null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          children: (entity.children ?? []).slice(0, 100).map((child: any) => ({ id: child.id, name: child.name, ctor: child.constructor.name })),
          components,
          graphicsNames,
          graphicsCurrent,
          graphicsKey: graphicsNames.join(',') + '|' + graphicsCurrent,
          serializerSource: usedSerialize ? 'serialize' : 'reflection'
        };
      } else {
        inspectedEntity = null;
      }
    } catch {
      inspectedEntity = null;
    }
  }

  // Live picker state, only while the picker is armed for this connection.
  // undefined = not armed (dropped by JSON.stringify); active: false tells
  // the panel the page-side picker is gone (Escape or navigation) so it must
  // disarm — the heartbeat reports, it never re-installs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let picker: any = undefined;
  if (settings.pickerActive) {
    const pickerState = window.___EXCALIBUR_DEVTOOL_EXTENSION_PICKER;
    picker = pickerState
      ? { active: true, hovered: pickerState.hovered, pickedId: pickerState.pickedId, pickSeq: pickerState.seq }
      : { active: false, hovered: null, pickedId: null, pickSeq: 0 };
  }

  // _originalOptions is a private engine field; guard for versions without it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  const {scenes: _, ...config } = (game as any)._originalOptions ?? {};

  // scene.physics is missing on older engines; never let it kill the payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const physicsConfig = (game.currentScene as any)?.physics?.config;

  // Game data is stringified to ensure get properties are called.
  return JSON.stringify({
    version: game.version,
    // Reflect the engine's actual debug-mode state so the panel can adopt it
    // on the first heartbeat rather than defaulting to false and clobbering
    // a previously-enabled overlay (see createDefaultDebugSettings/`inject`).
    isDebug: game.isDebug,
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
    inspectedEntity: inspectedEntity,
    picker: picker,
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
 * Creates the default debug settings for a panel connection. Each connection
 * gets its own copy so panels on different tabs never share state and a
 * closed panel's settings (e.g. collectMaterials) can't leak into the next.
 *
 * Every schema-defined setting is derived from `DefaultSettings` — the schema
 * in src/settings/schema.ts is the single source of truth, so a setting added
 * there is automatically known to the background and applied by `inject`.
 * Only the connection-lifecycle fields below live outside the schema.
 */
const createDefaultDebugSettings = () => ({
  collectMaterials: false,
  inspectEntityId: null as number | null,
  pickerActive: false,
  toggleDebug: undefined as boolean | undefined,
  // Deep-copied so a connection mutating a color can never bleed into the
  // shared schema default objects
  ...(JSON.parse(JSON.stringify(DefaultSettings)) as typeof DefaultSettings)
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

  const state: { tabId: number | null; selectedFrameId: number | null } = {
    tabId: null,
    selectedFrameId: null
  };

  // Per-connection settings: panels on different tabs must not share state
  const debugSettings = createDefaultDebugSettings();

  let pickerOpSeq = 0;

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
            if (debugSettings.pickerActive) {
              // the picker lives in the previously selected frame only
              pickerOpSeq++;
              debugSettings.pickerActive = false;
              execInFrame(message.tabId, state.selectedFrameId, stopEntityPicker);
            }
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
        case 'ex-debug:inspect-entity':
          {
            debugSettings.inspectEntityId = message.entityId ?? null;
          }
          break;
        case 'ex-debug:picker-start':
          {
            // Arm the flag only after install resolves so a heartbeat can't
            // observe pickerActive with no page global and wrongly disarm
            const op = ++pickerOpSeq;
            const frameId = state.selectedFrameId;
            execInFrame(message.tabId, frameId, startEntityPicker).then(() => {
              if (op === pickerOpSeq) {
                debugSettings.pickerActive = true;
              } else {
                // a stop/frame-switch/disconnect raced this install; tear
                // down the picker it left behind in the original frame
                execInFrame(message.tabId, frameId, stopEntityPicker);
              }
            });
          }
          break;
        case 'ex-debug:picker-stop':
          {
            pickerOpSeq++;
            debugSettings.pickerActive = false;
            execInFrame(message.tabId, state.selectedFrameId, stopEntityPicker);
          }
          break;
        case 'ex-debug:get-entity-graphics':
          {
            execInFrame(message.tabId, state.selectedFrameId, getEntityGraphics, [
              { entityId: message.entityId }
            ]).then((results) => {
              safePostMessage({
                name: 'ex-debug:entity-graphics',
                data: results?.[0]?.result ?? null
              });
            }).catch((e) => {
              console.info('entity graphics reply failed:', e);
            });
          }
          break;
        case 'ex-debug:update-entity-property':
          {
            execInFrame(message.tabId, state.selectedFrameId, updateEntityProperty, [message.update]);
          }
          break;
        case 'ex-debug:use-entity-graphic':
          {
            execInFrame(message.tabId, state.selectedFrameId, useEntityGraphic, [
              { entityId: message.entityId, graphicName: message.graphicName, source: message.source }
            ]);
          }
          break;
        default:
          console.info('Unhandled dispatch:', message.dispatch);
          break;
      }
    }
  });

  safePostMessage({
    name: 'ex-debug:init'
  });

  let failedHeartbeatTicks = 0;

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
        if (debugSettings.pickerActive && state.selectedFrameId !== null) {
          // the armed picker lives in the frame that just lost its game
          // (e.g. HMR cleared the global while the document survived);
          // tear it down or its click swallowers outlive the selection
          pickerOpSeq++;
          debugSettings.pickerActive = false;
          execInFrame(tabId, state.selectedFrameId, stopEntityPicker);
        }
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
      failedHeartbeatTicks = 0;
      safePostMessage({
        name: 'ex-debug:heartbeat',
        instances,
        selectedFrameId: state.selectedFrameId,
        data
      });
    } catch {
      // Non-injectable target (chrome:// page, dead tab) or a transient
      // executeScript failure. Skip a couple of ticks before telling the
      // panel there is nothing here — the panel keeps its last state and
      // its staleness detector (1.5s) stays well clear — while a
      // persistent failure still surfaces within ~600ms
      failedHeartbeatTicks++;
      if (failedHeartbeatTicks < 3) {
        return;
      }
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
    // invalidate any in-flight picker install so its .then tears it down
    // instead of arming a picker nobody can disarm
    pickerOpSeq++;
    if (debugSettings.pickerActive && state.tabId !== null) {
      // never leave the page swallowing canvas clicks after the panel closes
      debugSettings.pickerActive = false;
      execInFrame(state.tabId, state.selectedFrameId, stopEntityPicker);
    }
  });
});
