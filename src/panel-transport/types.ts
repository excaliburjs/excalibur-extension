import type { EventDispatchEvents } from '../protocol';

/**
 * The panel's connection to whatever drives the inspected game: the chrome
 * extension background (over a runtime Port) or the embedded in-page driver
 * (over an in-memory pair).
 *
 * Implementations own everything transport-specific: they stamp `tabId` on
 * outgoing messages and send `ex-debug:hello` on construction, so the panel
 * never touches extension APIs.
 */
export interface PanelTransport {
  /** Posts a message toward the driver. Throws if the transport is dead. */
  post(message: object): void;
  /** Registers the single inbound-message callback. */
  onMessage(cb: (message: EventDispatchEvents) => void): void;
  /** Registers the single disconnect callback. */
  onDisconnect(cb: () => void): void;
  /** Stops message delivery and disconnects. Safe to call twice. */
  disconnect(): void;
}

/**
 * Creates a fresh transport; called on every (re)connect attempt. May throw
 * when the driver is unreachable (e.g. extension context invalidated) — the
 * panel's reconnect loop retries.
 */
export type TransportFactory = () => PanelTransport;
