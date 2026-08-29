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
 * Kills an actor.
 */
export function kill(actorId: number) {
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
export function identifyEntity(entityId: number) {
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;
  const actor = game.currentScene.world.entityManager.getById(entityId) as
    | {
        actions: {
          repeat(fn: (ctx: { fade(opacity: number, duration: number): void }) => void, times: number): void;
        };
      }
    | undefined;
  if (actor === undefined) {
    throw new Error(`No entity found for id ${entityId}`);
  }
  actor.actions.repeat((context) => {
    context.fade(0, 200);
    context.fade(1, 200);
  }, 3);
}

/**
 * Fetches the heavy graphics payload for the inspected entity on demand:
 * graphics available on its GraphicsComponent plus the Serializer global
 * graphics registry (when the page exposes `window.ex`), with thumbnails.
 */
export function getEntityGraphics(query: { entityId: number }) {
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
  const registryAvailable = !!(
    serializer &&
    typeof serializer.getRegisteredGraphics === 'function' &&
    typeof serializer.getGraphic === 'function'
  );
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
export function updateEntityProperty(update: {
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
export function useEntityGraphic(query: { entityId: number; graphicName: string; source: 'local' | 'registry' }) {
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
