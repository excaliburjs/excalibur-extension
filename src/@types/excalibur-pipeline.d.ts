/**
 * Supplemental duck-type shapes for Excalibur's shader pipelines (PR #3828,
 * first shipped in 0.33.0-alpha.200). The vendored `excalibur.d.ts` is a
 * 0.32 snapshot and deliberately NOT regenerated (the nightly publishes a
 * multi-file .d.ts tree, not a rollup); these minimal interfaces describe
 * only the surface the devtools reads. Import them with `import type` ONLY —
 * this module never exists at runtime (see the cold-cache Parcel / Vite ESM
 * rule in CLAUDE.md).
 *
 * Underscore-prefixed members mirror engine-private fields the page
 * functions reach via duck typing; every runtime access must stay
 * optional-chained/try-caught so a nightly rename degrades gracefully.
 */

/** One pass of a shader pipeline (engine `ShaderPass`). */
export interface ShaderPassLike {
  name: string;
  /** Intermediate framebuffer scale relative to the pipeline source (default 1). */
  scale: number;
  /** ImageFiltering string, e.g. 'Blended' | 'Pixel'. */
  filtering: string;
  /** Writable watched uniform dictionary; assignments upload on next use(). */
  uniforms: Record<string, unknown>;
  /** LAZILY COMPILES the pass shader on first call — never call from a heartbeat. */
  getShader(): unknown;
  /** Engine-private: glsl-tag-processed fragment source; safe no-compile read. */
  _fragmentSource?: string;
  /** Engine-private: undefined until the pass first compiles/draws. */
  _shader?: unknown;
}

/** A linear pipeline of passes (engine `ShaderPipeline` / `ShaderPipelineLike`). */
export interface ShaderPipelineLike {
  name?: string;
  passes?: ShaderPassLike[];
  /**
   * Engine-private: intermediate framebuffers, index-aligned to `passes`;
   * entry i holds the OUTPUT of pass i and the last entry is always
   * undefined (the final pass writes to the caller's destination).
   */
  _intermediates?: (FramebufferLike | undefined)[];
}

/** A GPU render target (engine `Framebuffer`). */
export interface FramebufferLike {
  width: number;
  height: number;
  /** Resolves MSAA on MultisampleFramebuffer when touched. */
  texture: WebGLTexture;
  /** Bind target for gl.readPixels; plain FBO on pipeline framebuffers. */
  glFramebuffer: WebGLFramebuffer;
}
