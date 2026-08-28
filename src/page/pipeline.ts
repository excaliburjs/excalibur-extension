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
 * Fetches the heavy pipeline payload on demand for a material or
 * postprocessor: per-pass fragment sources and/or framebuffer captures of the
 * data flow (seed → intermediates → output). Sources and framebuffers are
 * individually opt-in so the live-refresh path can re-capture pixels without
 * re-shipping sources.
 *
 * Framebuffer pixels are read with gl.readPixels against the engine's plain
 * Framebuffer objects: contents are premultiplied alpha with a bottom-left
 * origin, so each capture is un-premultiplied and vertically flipped before
 * encoding. The previous FRAMEBUFFER_BINDING is always restored — corrupting
 * it would break the game's next frame.
 */
export function getPipelineDetail(query: {
  kind: 'material' | 'postprocessor';
  ownerId: number;
  ownerName: string;
  key: string;
  includeSources: boolean;
  includeFramebuffers: boolean;
}) {
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
  const gl: WebGL2RenderingContext | undefined = anyGame.graphicsContext?.__gl;

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
      candidates.find((m) => m && (m.id === query.ownerId || m.__exDevtoolsId === query.ownerId)) ??
      candidates.find((m) => m && m.name === query.ownerName)
    );
  }

  /** Resolves the target postprocessor by stamped devtools id, falling back to name. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findPostProcessor(): { pp: any; index: number } | null {
    const pps = anyGame.graphicsContext?._postprocessors;
    if (!Array.isArray(pps)) {
      return null;
    }
    for (let i = 0; i < pps.length; i++) {
      if (pps[i] && pps[i].__exDevtoolsId === query.ownerId) {
        return { pp: pps[i], index: i };
      }
    }
    for (let i = 0; i < pps.length; i++) {
      if (pps[i] && (pps[i].name === query.ownerName || pps[i].constructor?.name === query.ownerName)) {
        return { pp: pps[i], index: i };
      }
    }
    return null;
  }

  /**
   * Resolves the ShaderPass array behind any pipeline-shaped object (same
   * ladder as the heartbeat): public passes → effect wrappers' _pipeline →
   * BloomEffect's four named passes → single _pass → null (opaque).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function resolvePasses(candidate: any): any[] | null {
    if (!candidate) {
      return null;
    }
    if (Array.isArray(candidate.passes)) {
      return candidate.passes;
    }
    if (candidate._pipeline) {
      return resolvePasses(candidate._pipeline);
    }
    if (candidate._threshold && candidate._combine) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return [candidate._threshold, candidate._downsample, candidate._upsampleMerge, candidate._combine].filter((p: any) => !!p);
    }
    if (candidate._pass) {
      return [candidate._pass];
    }
    return null;
  }

  /**
   * Finds the intermediate framebuffer array behind a pipeline-shaped object.
   * Bloom keeps down/up ladders instead of _intermediates; they are listed in
   * execution order with no pass association.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function resolveIntermediates(candidate: any): { list: any[]; indexed: boolean } {
    if (!candidate) {
      return { list: [], indexed: false };
    }
    if (Array.isArray(candidate._intermediates)) {
      return { list: candidate._intermediates, indexed: true };
    }
    if (candidate._pipeline) {
      return resolveIntermediates(candidate._pipeline);
    }
    if (Array.isArray(candidate._downFramebuffers) && Array.isArray(candidate._upFramebuffers)) {
      return { list: candidate._downFramebuffers.concat(candidate._upFramebuffers), indexed: false };
    }
    return { list: [], indexed: false };
  }

  /**
   * Reads one framebuffer into a downscaled data url. Un-premultiplies (the
   * whole GL pipeline is premultiplied) and flips vertically (GL origin is
   * bottom-left). Restores the previous framebuffer binding no matter what.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function captureFb(fb: any): { width: number; height: number; dataUrl: string | null; note?: string } {
    try {
      const w = Math.max(1, Math.round(fb.width));
      const h = Math.max(1, Math.round(fb.height));
      if (!gl || !fb.glFramebuffer || w * h > 4096 * 4096) {
        return { width: w, height: h, dataUrl: null, note: 'capture unavailable' };
      }
      const pixels = new Uint8Array(w * h * 4);
      const prev = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb.glFramebuffer);
      try {
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      } finally {
        gl.bindFramebuffer(gl.FRAMEBUFFER, prev);
      }

      const imageData = new ImageData(w, h);
      const out = imageData.data;
      for (let y = 0; y < h; y++) {
        const srcRow = (h - 1 - y) * w * 4;
        const dstRow = y * w * 4;
        for (let i = 0; i < w * 4; i += 4) {
          const a = pixels[srcRow + i + 3];
          if (a === 0 || a === 255) {
            out[dstRow + i] = pixels[srcRow + i];
            out[dstRow + i + 1] = pixels[srcRow + i + 1];
            out[dstRow + i + 2] = pixels[srcRow + i + 2];
          } else {
            const scale = 255 / a;
            out[dstRow + i] = Math.min(255, Math.round(pixels[srcRow + i] * scale));
            out[dstRow + i + 1] = Math.min(255, Math.round(pixels[srcRow + i + 1] * scale));
            out[dstRow + i + 2] = Math.min(255, Math.round(pixels[srcRow + i + 2] * scale));
          }
          out[dstRow + i + 3] = a;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return { width: w, height: h, dataUrl: null, note: 'capture unavailable' };
      }
      ctx.putImageData(imageData, 0, 0);

      const maxDim = 512;
      if (Math.max(w, h) > maxDim) {
        const scale = maxDim / Math.max(w, h);
        const small = document.createElement('canvas');
        small.width = Math.max(1, Math.round(w * scale));
        small.height = Math.max(1, Math.round(h * scale));
        const smallCtx = small.getContext('2d');
        if (smallCtx) {
          smallCtx.drawImage(canvas, 0, 0, small.width, small.height);
          return { width: w, height: h, dataUrl: small.toDataURL() };
        }
      }
      return { width: w, height: h, dataUrl: canvas.toDataURL() };
    } catch {
      return { width: fb?.width ?? 0, height: fb?.height ?? 0, dataUrl: null, note: 'capture failed' };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const framebuffers: any[] = [];
  /** Appends one capture entry, degrading to a 'not yet drawn' placeholder. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pushCapture = (stage: string, passIndex: number | null, fb: any) => {
    if (!fb) {
      framebuffers.push({ stage, passIndex, width: 0, height: 0, dataUrl: null, note: 'not yet drawn' });
      return;
    }
    const capture = captureFb(fb);
    framebuffers.push({ stage, passIndex, ...capture });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pipelineOwner: any = null;
  let legacy = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let legacyShader: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let seedFb: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let outputFb: any = null;

  if (query.kind === 'material') {
    const material = findMaterial();
    if (!material) {
      return JSON.stringify(null);
    }
    pipelineOwner = material.pipeline ?? null;
    seedFb = material._seedFramebuffer ?? null;
    outputFb = material._outputFramebuffer ?? null;
  } else {
    const foundPp = findPostProcessor();
    if (!foundPp) {
      return JSON.stringify(null);
    }
    pipelineOwner = foundPp.pp;
    if (!resolvePasses(foundPp.pp) && typeof foundPp.pp.getShader === 'function') {
      legacy = true;
      try {
        legacyShader = foundPp.pp.getShader();
      } catch {
        legacyShader = null;
      }
    }
    // each postprocessor's final output lands in the ping-pong target it
    // rendered into this frame
    const targets = anyGame.graphicsContext?._postProcessTargets;
    if (Array.isArray(targets) && targets.length > 0) {
      outputFb = targets[foundPp.index % targets.length] ?? null;
    }
  }

  const passes = resolvePasses(pipelineOwner) ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sources: any[] | undefined = undefined;
  if (query.includeSources) {
    if (legacy) {
      sources = [
        {
          index: 0,
          name: 'screen shader',
          fragmentSource: legacyShader?.fragmentSource ?? ''
        }
      ];
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sources = passes.map((pass: any, index: number) => ({
        index,
        name: typeof pass.name === 'string' && pass.name ? pass.name : `pass ${index}`,
        // _fragmentSource is the no-compile read; getShader() would force a
        // lazy compile of a never-drawn pass
        fragmentSource: pass._fragmentSource ?? pass._shader?.fragmentSource ?? ''
      }));
    }
  }

  if (query.includeFramebuffers) {
    if (seedFb) {
      pushCapture('seed', null, seedFb);
    }
    const intermediates = resolveIntermediates(pipelineOwner);
    // when index-aligned to passes, the last entry is always undefined (the
    // final pass writes to the output/destination) — skip it
    const count = intermediates.indexed ? intermediates.list.length - 1 : intermediates.list.length;
    for (let i = 0; i < count; i++) {
      pushCapture('intermediate', intermediates.indexed ? i : null, intermediates.list[i]);
    }
    if (outputFb) {
      pushCapture('output', null, outputFb);
    }
  }

  return JSON.stringify({
    key: query.key,
    kind: query.kind,
    legacy: legacy || undefined,
    passes: sources,
    framebuffers: query.includeFramebuffers ? framebuffers : undefined,
    capturedAt: Date.now()
  });
}

/**
 * Writes one uniform value onto a pipeline pass of a material or
 * postprocessor. Assignments go through the pass's watched uniform
 * dictionary, so they upload on the next draw — this works on passes that
 * have not compiled yet. Vec values are rebuilt as Float32Array in the page
 * realm to satisfy the engine's instanceof dispatch.
 */
export function updatePassUniform(update: {
  ownerKind: 'material' | 'postprocessor';
  ownerId: number;
  ownerName: string;
  passIndex: number;
  uniformName: string;
  valueKind: 'float' | 'int' | 'bool' | 'floatArray';
  value: number | boolean | number[];
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
      candidates.find((m) => m && (m.id === update.ownerId || m.__exDevtoolsId === update.ownerId)) ??
      candidates.find((m) => m && m.name === update.ownerName)
    );
  }

  /**
   * Resolves the ShaderPass array behind any pipeline-shaped object (same
   * ladder as the heartbeat).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function resolvePasses(candidate: any): any[] | null {
    if (!candidate) {
      return null;
    }
    if (Array.isArray(candidate.passes)) {
      return candidate.passes;
    }
    if (candidate._pipeline) {
      return resolvePasses(candidate._pipeline);
    }
    if (candidate._threshold && candidate._combine) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return [candidate._threshold, candidate._downsample, candidate._upsampleMerge, candidate._combine].filter((p: any) => !!p);
    }
    if (candidate._pass) {
      return [candidate._pass];
    }
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pipelineOwner: any = null;
  if (update.ownerKind === 'material') {
    const material = findMaterial();
    pipelineOwner = material?.pipeline ?? null;
  } else {
    const pps = anyGame.graphicsContext?._postprocessors;
    if (Array.isArray(pps)) {
      pipelineOwner =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pps.find((pp: any) => pp && pp.__exDevtoolsId === update.ownerId) ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pps.find((pp: any) => pp && (pp.name === update.ownerName || pp.constructor?.name === update.ownerName)) ??
        null;
    }
  }

  const passes = resolvePasses(pipelineOwner);
  const pass = passes?.[update.passIndex];
  if (!pass || !pass.uniforms) {
    return;
  }

  if (update.valueKind === 'floatArray') {
    pass.uniforms[update.uniformName] = new Float32Array(update.value as number[]);
  } else if (update.valueKind === 'bool') {
    pass.uniforms[update.uniformName] = !!update.value;
  } else {
    pass.uniforms[update.uniformName] = Number(update.value);
  }
}
