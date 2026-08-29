import * as ex from 'excalibur';

export const FIXTURE_FRAGMENT_SOURCE = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_graphic;
uniform float u_intensity;
out vec4 fragColor;
void main() {
  vec4 color = texture(u_graphic, v_uv);
  fragColor = color * u_intensity;
}`;

/**
 * Pass sources are processed by the excalibur glsl tag (ShaderPass does this
 * internally): no #version/precision, straight-alpha authoring, `u_image` is
 * the previous pass's output, `v_uv` the destination UV.
 */
export const FIXTURE_PASS_SOURCES: [string, string] = [
  `in vec2 v_uv;
uniform sampler2D u_image;
uniform float u_strength;
out vec4 fragColor;
void main() {
  vec4 color = texture(u_image, v_uv);
  fragColor = vec4(color.r * u_strength, color.gba);
}`,
  `in vec2 v_uv;
uniform sampler2D u_image;
out vec4 fragColor;
void main() {
  vec4 color = texture(u_image, v_uv);
  fragColor = vec4(color.b, color.g, color.r, color.a);
}`
];

/** Single pass run over the screen by the fixture's pipeline postprocessor. */
export const FIXTURE_PP_PASS_SOURCE = `in vec2 v_uv;
uniform sampler2D u_image;
uniform float u_wobble;
out vec4 fragColor;
void main() {
  vec4 color = texture(u_image, v_uv);
  fragColor = vec4(color.rgb * (1.0 - clamp(u_wobble, 0.0, 0.9)), color.a);
}`;

/**
 * Full 300 es source for the legacy (0.32-style getShader) postprocessor;
 * ScreenShader compiles it verbatim, no glsl-tag processing.
 */
export const FIXTURE_LEGACY_PP_SOURCE = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_image;
out vec4 fragColor;
void main() {
  fragColor = texture(u_image, v_uv);
}`;

/**
 * A 0.32-style postprocessor (deprecated getShader/getLayout surface) so the
 * devtools' legacy classification path stays exercised on the nightly engine.
 */
export class FixtureLegacyPostProcessor implements ex.PostProcessor {
  private _screenShader!: ex.ScreenShader;

  /** Builds the screen shader eagerly, as 0.32-era postprocessors did. */
  initialize(graphicsContext: ex.ExcaliburGraphicsContextWebGL): void {
    this._screenShader = new ex.ScreenShader(graphicsContext, FIXTURE_LEGACY_PP_SOURCE);
  }

  /** Deprecated single-shader surface the devtools classifies as 'legacy'. */
  getShader(): ex.Shader {
    return this._screenShader.getShader();
  }

  /** Layout for the deprecated screen-renderer path. */
  getLayout(): ex.VertexLayout {
    return this._screenShader.getLayout();
  }
}

export interface FixtureGame {
  game: ex.Engine;
  hero: ex.Actor;
  shaded: ex.Actor;
  material: ex.Material;
  /** Actor rendered through the two-pass pipeline material. */
  piped: ex.Actor;
  /** Material with a two-pass shader pipeline (u_strength on pass 0). */
  pipelineMaterial: ex.Material;
  /** Pipeline postprocessor named 'ripple' with one pass (u_wobble). */
  pipelinePostProcessor: ex.ShaderPipelinePostProcessor;
  /** Legacy 0.32-style postprocessor. */
  legacyPostProcessor: FixtureLegacyPostProcessor;
  /** Stops the game and removes the devtools global from the window. */
  dispose(): void;
}

/**
 * Boots a small real Excalibur game for browser tests: two scenes, a named
 * actor ("hero"), and a second actor ("shaded") rendered through a custom
 * Material with a `u_intensity` uniform (exercising the materials tab).
 *
 * The Engine constructor sets `window.___EXCALIBUR_DEVTOOL` on its own — the
 * devtools (embedded or extension) need no registration call.
 */
export async function createFixtureGame(): Promise<FixtureGame> {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);

  const game = new ex.Engine({
    canvasElement: canvas,
    width: 320,
    height: 240,
    suppressPlayButton: true,
    suppressConsoleBootMessage: true
  });

  const hero = new ex.Actor({
    name: 'hero',
    x: 100,
    y: 100,
    width: 20,
    height: 20,
    color: ex.Color.Red
  });
  game.add(hero);

  const material = game.graphicsContext.createMaterial({
    name: 'glow',
    fragmentSource: FIXTURE_FRAGMENT_SOURCE
  });
  material.uniforms.u_intensity = 1;

  const shaded = new ex.Actor({
    name: 'shaded',
    x: 200,
    y: 100,
    width: 20,
    height: 20,
    color: ex.Color.Blue
  });
  shaded.graphics.material = material;
  game.add(shaded);

  const pipelineMaterial = game.graphicsContext.createMaterial({
    name: 'pipelined',
    passes: [...FIXTURE_PASS_SOURCES]
  });
  // pass uniforms live on the pass, not the composite material
  (pipelineMaterial.pipeline as ex.ShaderPipeline).passes[0].uniforms.u_strength = 1;

  const piped = new ex.Actor({
    name: 'piped',
    x: 100,
    y: 180,
    width: 20,
    height: 20,
    color: ex.Color.Green
  });
  piped.graphics.material = pipelineMaterial;
  game.add(piped);

  const pipelinePostProcessor = new ex.ShaderPipelinePostProcessor({
    name: 'ripple',
    passes: [FIXTURE_PP_PASS_SOURCE]
  });
  game.graphicsContext.addPostProcessor(pipelinePostProcessor);

  const legacyPostProcessor = new FixtureLegacyPostProcessor();
  game.graphicsContext.addPostProcessor(legacyPostProcessor);

  game.addScene('level2', new ex.Scene());

  await game.start();

  return {
    game,
    hero,
    shaded,
    material,
    piped,
    pipelineMaterial,
    pipelinePostProcessor,
    legacyPostProcessor,
    dispose: () => {
      try {
        game.stop();
        game.dispose();
      } catch {
        // best-effort teardown
      }
      delete (window as { ___EXCALIBUR_DEVTOOL?: unknown }).___EXCALIBUR_DEVTOOL;
      canvas.remove();
    }
  };
}

/**
 * Polls until the predicate returns a truthy value or the timeout elapses.
 */
export async function waitFor<T>(predicate: () => T | null | undefined | false, timeoutMs = 3000, intervalMs = 25): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = predicate();
    if (value) {
      return value;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
