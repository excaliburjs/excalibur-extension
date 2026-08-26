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

export interface FixtureGame {
  game: ex.Engine;
  hero: ex.Actor;
  shaded: ex.Actor;
  material: ex.Material;
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

  game.addScene('level2', new ex.Scene());

  await game.start();

  return {
    game,
    hero,
    shaded,
    material,
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
