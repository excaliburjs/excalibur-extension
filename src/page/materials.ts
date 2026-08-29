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
 * Updates a single uniform value (or the material color) on a material.
 *
 * Values arrive as JSON (numbers/booleans/number arrays); vectors and matrices
 * are assigned as Float32Array built in the page realm so the engine's
 * `instanceof Float32Array` uniform dispatch applies them by GL type.
 */
export function updateMaterialUniform(update: {
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

  /**
   * QUery ex for materials (if any)
   */
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
export function getMaterialDetail(query: { materialId: number; materialName: string }) {
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

  const id = typeof material.id === 'number' ? material.id : (material.__exDevtoolsId ?? 0);
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
