/*
 * PAGE FUNCTION MODULE — every exported function here is serialized into the
 * inspected page via Function.prototype.toString (chrome.scripting.executeScript
 * with world: 'MAIN'), or called directly by the embedded build.
 *
 * Constraints (enforced by eslint no-restricted-imports on src/page/**):
 * - No runtime imports and no references to module scope — bodies must be
 *   fully self-contained (type-only imports are fine).
 * - Arguments and return values must be JSON-serializable.
 * - Return sentinels (null / no-op) when no game exists — never throw.
 * - es2016 syntax only; the code runs verbatim in arbitrary pages.
 */

/**
 * Injects settings defined by the devtool into the game. Information about
 * the game state is then returned from this function.
 * @param {object} settings - Flat settings object
 * @param {object} mappings - Map of setting keys to game.debug.* paths
 */
export function inject(settings: Record<string, unknown>, mappings: Record<string, string>) {
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
  const sceneNames: string[] = [];
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
          case gl.FLOAT:
            return 'float';
          case gl.FLOAT_VEC2:
            return 'vec2';
          case gl.FLOAT_VEC3:
            return 'vec3';
          case gl.FLOAT_VEC4:
            return 'vec4';
          case gl.INT:
            return 'int';
          case gl.INT_VEC2:
            return 'ivec2';
          case gl.INT_VEC3:
            return 'ivec3';
          case gl.INT_VEC4:
            return 'ivec4';
          case gl.UNSIGNED_INT:
            return 'uint';
          case gl.BOOL:
            return 'bool';
          case gl.BOOL_VEC2:
            return 'bvec2';
          case gl.BOOL_VEC3:
            return 'bvec3';
          case gl.BOOL_VEC4:
            return 'bvec4';
          case gl.FLOAT_MAT2:
            return 'mat2';
          case gl.FLOAT_MAT3:
            return 'mat3';
          case gl.FLOAT_MAT4:
            return 'mat4';
          case gl.SAMPLER_2D:
            return 'sampler2D';
          case gl.SAMPLER_3D:
            return 'sampler3D';
          case gl.SAMPLER_CUBE:
            return 'samplerCube';
          case gl.SAMPLER_2D_ARRAY:
            return 'sampler2DArray';
          default:
            return `0x${glType.toString(16)}`;
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
          children: (entity.children ?? [])
            .slice(0, 100)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((child: any) => ({ id: child.id, name: child.name, ctor: child.constructor.name })),
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
  const { scenes: _, ...config } = (game as any)._originalOptions ?? {};

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
