/**
 * Shared message types for the port protocol between the background worker
 * and the devtools panel.
 */

/**
 * An Excalibur instance detected in one frame of the inspected tab.
 */
export interface ExInstance {
  frameId: number;
  title: string;
  url: string;
  version: string;
  /** Master debug flag of the game in this frame (from detectExcalibur). */
  isDebug: boolean;
}

/**
 * A single property write requested by the entity inspector panel.
 *
 * The injected writer resolves the target component by duck-typing and only
 * applies writes on an explicit allowlist of (target, property) pairs.
 * Rotation always travels in radians (engine units); the panel converts
 * to/from degrees for display. Vector edits always carry the whole vector so
 * one axis edit can't race the other.
 */
export interface EntityPropertyUpdate {
  entityId: number;
  target: 'entity' | 'transform' | 'motion' | 'graphics' | 'body';
  property: string;
  kind: 'number' | 'boolean' | 'string' | 'vector';
  value: number | boolean | string | { x: number; y: number };
}

/**
 * One serialized component of an inspected entity, normalized so the panel
 * never needs to know whether it came from Component.serialize() (v0.33+) or
 * the reflection fallback for older engines.
 */
export interface InspectedComponent {
  /** Constructor name, e.g. 'TransformComponent' */
  type: string;
  kind: 'transform' | 'motion' | 'graphics' | 'body' | 'collider' | 'unknown';
  data: Record<string, unknown>;
  error?: boolean;
}

/**
 * Deep-serialized entity included in the heartbeat while the inspector
 * dialog is open (`inspectEntityId` set on the connection's debug settings).
 */
export interface InspectedEntity {
  id: number;
  name: string;
  ctor: string;
  tags: string[];
  isKilled: boolean;
  parent: { id: number; name: string } | null;
  children: { id: number; name: string; ctor: string }[];
  components: InspectedComponent[];
  graphicsNames: string[];
  graphicsCurrent: string;
  graphicsKey: string;
  serializerSource: 'serialize' | 'reflection';
}

/**
 * Thumbnail info for one graphic, rendered as a tile in the graphics switcher.
 */
export interface GraphicThumb {
  name: string;
  type: string;
  width: number;
  height: number;
  dataUrl: string | null;
}

/**
 * On-demand heavy graphics detail for the inspected entity
 * (reply to ex-debug:get-entity-graphics).
 */
export interface EntityGraphicsDetail {
  entityId: number;
  graphicsKey: string;
  current: string;
  local: GraphicThumb[];
  registryAvailable: boolean;
  registry: GraphicThumb[];
}

/**
 * Live entity-picker state carried in the heartbeat while the picker is
 * armed (`pickerActive` on the connection's debug settings). `active: false`
 * means the page-side picker is gone (Escape pressed or the page navigated)
 * and the panel must disarm its toggle.
 */
export interface PickerState {
  active: boolean;
  hovered: { id: number; name: string; ctor: string } | null;
  pickedId: number | null;
  pickSeq: number;
}

/**
 * Heartbeat posted by the background worker every 200ms.
 */
export interface HeartbeatMessage {
  name: 'ex-debug:heartbeat';
  instances: ExInstance[];
  selectedFrameId: number | null;
  data: string | null;
}

/**
 * Pure "the driver (re)started" signal, no payload; the panel responds by
 * pushing its settings down and restoring per-session state.
 */
export interface InitEvent {
  name: 'ex-debug:init';
}

/**
 * On-demand reply carrying the heavy per-material payload as a JSON string.
 */
export interface MaterialDetailEvent {
  name: 'ex-debug:material-detail';
  data: string | null;
}

/**
 * On-demand reply carrying the inspected entity's graphics as a JSON string.
 */
export interface EntityGraphicsEvent {
  name: 'ex-debug:entity-graphics';
  data: string | null;
}

/**
 * On-demand reply carrying pipeline pass sources and/or framebuffer captures
 * as a JSON string (see PipelineDetail in components/pipeline-view.ts).
 */
export interface PipelineDetailEvent {
  name: 'ex-debug:pipeline-detail';
  data: string | null;
}

/**
 * Pushed to the panel when an extension surface other than the panel itself
 * (currently the toolbar popup) toggles the game's debug flag. The panel
 * adopts the value so its state can't drift from the live game; whether the
 * panel is "user authoritative" (`_toggleDebugUserSet`) is not affected.
 */
export interface DebugToggledEvent {
  name: 'ex-debug:debug-toggled';
  value: boolean;
}

/**
 * Every message the driver can post to the panel.
 */
export type EventDispatchEvents =
  | InitEvent
  | HeartbeatMessage
  | MaterialDetailEvent
  | EntityGraphicsEvent
  | PipelineDetailEvent
  | DebugToggledEvent;

/**
 * Reply to the popup's one-shot runtime.sendMessage requests handled by the
 * background (`ex-debug:popup-get-state`, `ex-debug:popup-toggle-debug`).
 * `instances` is empty when the tab has no game (or can't be injected).
 */
export interface PopupStateReply {
  instances: ExInstance[];
  /** True when any detected instance has its debug flag on. */
  anyOn: boolean;
}
