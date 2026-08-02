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
