/*
 * Shared types for the P2P transport and transfer protocol layers.
 * =================================================================
 * These types define the seam between the UI and the transport/protocol
 * modules. The UI talks only to these interfaces — never to PeerJS directly.
 */

/*
 * Connection status for the transport layer.
 * - "disconnected": No peer connection active.
 * - "connecting": Outbound connection initiated, waiting for open.
 * - "connected": Data channel is open and ready.
 */
export type ConnectionStatus = "disconnected" | "connecting" | "connected";

/*
 * Events emitted by a Transport implementation.
 *
 * The transport unifies the PeerJS peer + DataConnection into one event
 * interface — callers never need to know about the two-layer WebRTC model.
 */
export interface TransportEvents {
  connected: [remoteId: string];
  disconnected: [];
  data: [data: unknown];
  error: [error: Error];
  incoming: [remoteId: string];
  "peer-id": [id: string];
}

/*
 * Transport interface — abstracts the peer-to-peer transport layer.
 *
 * Behind this interface lives PeerJS (WebRTC), but a fake transport can
 * be swapped in for deterministic testing without a browser.
 */
export interface Transport {
  readonly peerId: string | null;
  readonly status: ConnectionStatus;

  connect(remoteId: string): void;
  send(data: unknown): void;
  close(): void;
  destroy(): void;

  on<K extends keyof TransportEvents>(
    event: K,
    listener: (...args: TransportEvents[K]) => void,
  ): void;
  off<K extends keyof TransportEvents>(
    event: K,
    listener: (...args: TransportEvents[K]) => void,
  ): void;
}

/*
 * Protocol message types exchanged over the transport.
 * These are the wire format — every message sent or received matches one
 * of these shapes.
 */
export type TransferData =
  | { type: "ping" }
  | { type: "pong" }
  | {
      type: "metadata";
      id: string;
      name: string;
      size: number;
      fileType: string;
    }
  | { type: "chunk"; id: string; chunk: Uint8Array | ArrayBuffer }
  | { type: "end"; id: string };

/*
 * Snapshot of a single file transfer — what the UI renders.
 */
export interface TransferSnapshot {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "sending" | "receiving" | "completed" | "error" | "ready";
  type: string;
  url?: string;
  speed?: number;
}

/*
 * Chunk size in bytes for file transfer.
 * 16 KB is well within WebRTC data channel limits (~256 KB varies by browser)
 * and allows granular progress reporting.
 */
export const CHUNK_SIZE = 16384;
