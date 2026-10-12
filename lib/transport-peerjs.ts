/*
 * PeerJS transport implementation.
 * ==================================
 * Wraps the PeerJS library behind the Transport interface so the rest of
 * the application never touches PeerJS directly.
 *
 * Heartbeat (ping/pong):
 *   WebRTC ICE timeout can take 30+ seconds to detect a dropped connection.
 *   We send a ping every 3 seconds and expect a pong within 7 seconds. If
 *   the pong is overdue, we close the connection proactively.
 *
 * This file is the ONLY module that imports from "peerjs".
 */

import { Peer, type DataConnection } from "peerjs";
import type { ConnectionStatus, Transport, TransportEvents } from "./types";

type Listener = (...args: any[]) => void;

export class PeerJSTransport implements Transport {
  private _peer: Peer | null = null;
  private _conn: DataConnection | null = null;
  private _peerId: string | null = null;
  private _status: ConnectionStatus = "disconnected";

  private listeners = new Map<string, Set<Listener>>();

  private lastPongTimestamp = 0;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this._peer = new Peer();

    this._peer.on("open", (id: string) => {
      this._peerId = id;
      this._emit("peer-id", id);
    });

    this._peer.on("connection", (conn: DataConnection) => {
      this._attachConnection(conn);
      this._emit("incoming", conn.peer);
    });

    this._peer.on("error", (err: Error) => {
      this._emit("error", err);
    });
  }

  get peerId(): string | null {
    return this._peerId;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  connect(remoteId: string): void {
    if (!this._peer) return;
    this._status = "connecting";
    const conn = this._peer.connect(remoteId);
    this._attachConnection(conn);
  }

  send(data: unknown): void {
    if (this._conn?.open) {
      this._conn.send(data);
    }
  }

  close(): void {
    this._stopHeartbeat();
    if (this._conn) {
      this._conn.close();
      this._conn = null;
    }
    this._status = "disconnected";
    this._emit("disconnected");
  }

  destroy(): void {
    this._stopHeartbeat();
    this._conn?.close();
    this._conn = null;
    this._peer?.destroy();
    this._peer = null;
    this._peerId = null;
    this._status = "disconnected";
    this.listeners.clear();
  }

  on<K extends keyof TransportEvents>(
    event: K,
    listener: (...args: TransportEvents[K]) => void,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener);
  }

  off<K extends keyof TransportEvents>(
    event: K,
    listener: (...args: TransportEvents[K]) => void,
  ): void {
    this.listeners.get(event)?.delete(listener as Listener);
  }

  /*
   * Attach event handlers to a DataConnection (both outbound and inbound).
   * Starts the heartbeat once the connection opens.
   */
  private _attachConnection(conn: DataConnection): void {
    this._conn = conn;

    conn.on("open", () => {
      this._status = "connected";
      this.lastPongTimestamp = Date.now();
      this._startHeartbeat();
      this._emit("connected", conn.peer);
    });

    conn.on("data", (data: unknown) => {
      this.lastPongTimestamp = Date.now();
      this._emit("data", data);
    });

    conn.on("close", () => {
      this._stopHeartbeat();
      this._status = "disconnected";
      this._conn = null;
      this._emit("disconnected");
    });
  }

  private _startHeartbeat(): void {
    this._stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (!this._conn?.open) {
        this._stopHeartbeat();
        return;
      }
      if (Date.now() - this.lastPongTimestamp > 7000) {
        this.close();
        return;
      }
      this._conn?.send({ type: "ping" });
    }, 3000);
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private _emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
  }
}
