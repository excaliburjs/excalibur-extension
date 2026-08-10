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
  /** Duck-typed classification used to pick a purpose-built editor */
  kind: 'transform' | 'motion' | 'graphics' | 'body' | 'collider' | 'unknown';
  /** Sanitized serialized data (non-finite numbers become strings) */
  data: Record<string, unknown>;
  /** True when serialization threw for this component */
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
  /** Graphic names available on the entity's GraphicsComponent */
  graphicsNames: string[];
  /** Name of the currently shown graphic ('' when none) */
  graphicsCurrent: string;
  /** Cheap change-detection key; a change triggers a graphics detail re-fetch */
  graphicsKey: string;
  /** Which serialization path produced the component data */
  serializerSource: 'serialize' | 'reflection';
}

/**
 * Thumbnail info for one graphic, rendered as a tile in the graphics switcher.
 */
export interface GraphicThumb {
  name: string;
  /** Graphic constructor name, e.g. 'Sprite', 'Animation' */
  type: string;
  width: number;
  height: number;
  /** Data URL of a capped-size thumbnail, null when unavailable */
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
  /** Graphics registered on the entity's own GraphicsComponent */
  local: GraphicThumb[];
  /** False when window.ex.Serializer is unreachable in the page */
  registryAvailable: boolean;
  /** Graphics from the Serializer global graphics registry */
  registry: GraphicThumb[];
}

/**
 * Heartbeat posted by the background worker every 200ms.
 */
export interface HeartbeatMessage {
  name: 'ex-debug:heartbeat';
  /** Excalibur instances detected across all frames of the inspected tab */
  instances: ExInstance[];
  /** Frame currently being inspected, null when no instance exists */
  selectedFrameId: number | null;
  /** JSON-serialized game state from the selected frame, null when unavailable */
  data: string | null;
}
