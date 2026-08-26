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
 * Installs the page-side entity picker: capture-phase pointer listeners, a
 * DOM highlight overlay, and a rAF loop that re-projects the highlight as
 * the camera or entities move under a stationary cursor. Hit-testing mirrors
 * the engine's own PointerSystem algorithm using only public API
 * (physics.query + collider.contains, plus GraphicsComponent world bounds —
 * which already handle CoordPlane.Screen via the camera inverse) so it never
 * touches version-fragile internals. Pick clicks on the canvas are swallowed
 * before the engine's own listeners see them. Results are left on
 * window.___EXCALIBUR_DEVTOOL_EXTENSION_PICKER for the heartbeat to read;
 * Escape and stopEntityPicker share the teardown stored there. Idempotent -
 * a second call while already armed is a no-op, so ignoredCtors/ignoredNames
 * here are only the *initial* values; setPickerIgnored updates them live.
 */
export function startEntityPicker(ignoredCtors: string[] = [], ignoredNames: string[] = []) {
  if (window.___EXCALIBUR_DEVTOOL_EXTENSION_PICKER) {
    return;
  }
  if (!window.___EXCALIBUR_DEVTOOL) {
    return;
  }

  /**
   * @typedef {import('./@types/excalibur').Engine} Engine
   * @type {Engine}
   */
  const game = window.___EXCALIBUR_DEVTOOL;

  const state: NonNullable<Window['___EXCALIBUR_DEVTOOL_EXTENSION_PICKER']> = {
    seq: 0,
    pickedId: null,
    hovered: null,
    ignoredCtors: Array.isArray(ignoredCtors) ? ignoredCtors : [],
    ignoredNames: Array.isArray(ignoredNames) ? ignoredNames : [],
    teardown: () => {
      // replaced with the real teardown once listeners are installed
    }
  };

  // Highlight rect + name chip, positioned in page coordinates so scroll,
  // canvas CSS scaling, and pixelRatio are all handled by the engine's
  // world->page projection
  const highlight = document.createElement('div');
  highlight.style.cssText =
    'position:absolute;pointer-events:none;z-index:2147483647;' + 'background:rgba(255,213,46,0.15);box-sizing:border-box;display:none;';

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
    } catch {
      // pass
    }

    return -Infinity;
  };

  // Composite pick score: z-order, proximity to the candidate's own bounds
  // center, and inverse bounds area, each normalized to 0..1 across the
  // current candidate set (so it stays meaningful regardless of the game's
  // own z/world-unit scale) then combined with fixed weights. This lets a
  // small actor nested on/inside a much larger one (an icon over a
  // full-screen background, say) win the pick even when it isn't strictly
  // the highest z - pure z-order alone made those effectively unpickable.
  const Z_WEIGHT = 0.5;
  const PROXIMITY_WEIGHT = 0.25;
  const SIZE_WEIGHT = 0.25;
  const AREA_FALLBACK = 1e9;
  const Z_FALLBACK = -1e9;

  const norm = (value: number, min: number, max: number) => (max - min > 1e-9 ? (value - min) / (max - min) : 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pickTopEntity = (entities: any[], worldVec: { x: number; y: number }) => {
    if (entities.length === 0) {
      return null;
    }
    const scored = entities.map((entity) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bounds: any = null;
      try {
        bounds = entity.graphics?.bounds ?? entity.collider?.bounds ?? null;
      } catch {
        bounds = null;
      }
      let dist = 0;
      let area = AREA_FALLBACK;
      if (bounds) {
        const cx = (bounds.left + bounds.right) / 2;
        const cy = (bounds.top + bounds.bottom) / 2;
        const dx = worldVec.x - cx;
        const dy = worldVec.y - cy;
        dist = Math.sqrt(dx * dx + dy * dy);
        const w = Math.abs(bounds.right - bounds.left);
        const h = Math.abs(bounds.bottom - bounds.top);
        area = Math.max(w * h, 1);
      }
      const rawZ = getEntityZ(entity);
      return { entity, z: Number.isFinite(rawZ) ? rawZ : Z_FALLBACK, dist, area };
    });

    const zVals = scored.map((s) => s.z);
    const distVals = scored.map((s) => s.dist);
    const areaVals = scored.map((s) => s.area);
    const minZ = Math.min(...zVals);
    const maxZ = Math.max(...zVals);
    const minDist = Math.min(...distVals);
    const maxDist = Math.max(...distVals);
    const minArea = Math.min(...areaVals);
    const maxArea = Math.max(...areaVals);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let top: any = null;
    let topScore = -Infinity;
    for (const s of scored) {
      const zScore = norm(s.z, minZ, maxZ);
      const proximityScore = 1 - norm(s.dist, minDist, maxDist);
      const sizeScore = 1 - norm(s.area, minArea, maxArea);
      const score = zScore * Z_WEIGHT + proximityScore * PROXIMITY_WEIGHT + sizeScore * SIZE_WEIGHT;
      if (top === null || score > topScore || (score === topScore && s.entity.id > top.id)) {
        top = s.entity;
        topScore = score;
      }
    }
    return top;
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

      // Read live so a mid-pick ignore-list edit (setPickerIgnored) takes
      // effect on the very next hover tick without reinstalling.
      const ignoredCtors = new Set(state.ignoredCtors);
      const ignoredNames = new Set(state.ignoredNames);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isIgnored = (entity: any) =>
        (ignoredCtors.size > 0 && ignoredCtors.has(String(entity?.constructor?.name))) ||
        (ignoredNames.size > 0 && ignoredNames.has(String(entity?.name)));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hits = new Map<number, any>();
      try {
        if (scene.physics && typeof scene.physics.query === 'function') {
          for (const collider of scene.physics.query(worldVec) ?? []) {
            const owner = collider?.owner;
            if (!owner || (typeof owner.isKilled === 'function' && owner.isKilled())) {
              continue;
            }
            if (isIgnored(owner)) {
              continue;
            }
            if (typeof collider.contains === 'function' && !collider.contains(worldVec)) {
              continue;
            }
            hits.set(owner.id, owner);
          }
        }
      } catch {
        // pass
      }

      try {
        for (const entity of scene.entities ?? []) {
          if (hits.has(entity.id) || (typeof entity.isKilled === 'function' && entity.isKilled())) {
            continue;
          }
          if (isIgnored(entity)) {
            continue;
          }
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((entity as any).graphics) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const bounds = (entity as any).graphics?.bounds;
              if (bounds && typeof bounds.contains === 'function' && bounds.contains(worldVec)) {
                hits.set(entity.id, entity);
              }
            }
          } catch {
            // pass
          }
        }
      } catch {
        // pass
      }

      if (hits.size === 0) {
        return null;
      }

      const top = pickTopEntity(Array.from(hits.values()), worldVec);
      if (!top) {
        return null;
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
    if (hovered.bounds && scratchVec && game.screen && typeof game.screen.worldToPageCoordinates === 'function') {
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
      } catch {
        // pass
      }
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
    // Ignore moves over the embedded devtools dock (extension: attribute never
    // present) so hovering the panel doesn't hit-test the game underneath
    const target = e.target as Element | null;
    if (target && target.closest && target.closest('[data-ex-devtools-ui]')) {
      return;
    }
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

/**
 * Cancel the entity picker and cleanup
 */
export function stopEntityPicker() {
  const picker = window.___EXCALIBUR_DEVTOOL_EXTENSION_PICKER;
  if (picker && typeof picker.teardown === 'function') {
    try {
      picker.teardown();
    } catch {
      // pass
    }
  }
  window.___EXCALIBUR_DEVTOOL_EXTENSION_PICKER = undefined;
}

/**
 * Live-updates the ignored constructor/name lists on an already-installed
 * picker (startEntityPicker is idempotent-guarded once armed, so re-running
 * it can't push a new list). No-op if the picker isn't currently installed -
 * the next picker-start carries the current lists as their initial value.
 */
export function setPickerIgnored(ctors: string[], names: string[]) {
  const picker = window.___EXCALIBUR_DEVTOOL_EXTENSION_PICKER;
  if (picker) {
    picker.ignoredCtors = Array.isArray(ctors) ? ctors : [];
    picker.ignoredNames = Array.isArray(names) ? names : [];
  }
}
