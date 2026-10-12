/*
 * ChunkedTransfer — owns the file chunking, sending, receiving, and
 * reassembly protocol.
 * =========================================================================
 * This class encapsulates the file transfer wire protocol:
 *
 *   sender:  metadata(name, size, type) → chunk(data) × N → end
 *   receiver:  metadata ← chunk(data) × N ← end → assemble Blob
 *
 * All accumulation state (incoming chunks, received bytes, timing) lives
 * here, not in React refs. The UI subscribes to snapshot updates via the
 * subscribe() method and renders declaratively.
 *
 * The class is transport-agnostic — it receives a Transport on sendFile()
 * and expects data to be forwarded from the transport's "data" event via
 * handleData(). This separation means the protocol logic is testable with
 * a fake transport.
 */

import type { Transport, TransferData, TransferSnapshot } from "./types";

const CHUNK_SIZE = 16384;

export class ChunkedTransfer {
  /* Accumulation buffers — one per incoming file */
  private incomingChunks = new Map<string, Uint8Array[]>();
  private receivedSize = new Map<string, number>();
  private incomingStartTimes = new Map<string, number>();

  /* Current snapshot of all transfers */
  private snapshots: TransferSnapshot[] = [];

  /* Subscribers receive the latest snapshot array on every change */
  private subscribers = new Set<(snapshots: TransferSnapshot[]) => void>();

  /*
   * Send a File over the given transport.
   *
   * Generates a unique ID, sends metadata, reads the file in 16 KB chunks
   * via FileReader, sends each chunk, and finishes with an end signal.
   *
   * Returns a promise that resolves when the transfer completes or rejects
   * if the connection drops mid-transfer.
   */
  sendFile(transport: Transport, file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const fileId = Math.random().toString(36).substring(7);
      let aborted = false;

      this._addSnapshot({
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 0,
        status: "sending",
      });

      transport.send({
        type: "metadata",
        id: fileId,
        name: file.name,
        size: file.size,
        fileType: file.type,
      } satisfies TransferData);

      const reader = new FileReader();
      let offset = 0;
      const startTime = Date.now();

      const readNext = () => {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        reader.readAsArrayBuffer(slice);
      };

      reader.onload = (event) => {
        if (aborted) return;

        if (!transport.status || transport.status !== "connected") {
          aborted = true;
          this._markError(fileId);
          reject(new Error("Connection lost during send"));
          return;
        }

        const chunk = event.target?.result as ArrayBuffer;
        if (!chunk || chunk.byteLength === 0) return;

        transport.send({
          type: "chunk",
          id: fileId,
          chunk,
        } satisfies TransferData);

        offset += chunk.byteLength;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? offset / elapsed : 0;

        this._updateProgress(fileId, (offset / file.size) * 100, speed);

        if (offset < file.size) {
          readNext();
        } else {
          transport.send({ type: "end", id: fileId } satisfies TransferData);
          this._markCompleted(fileId);
          resolve();
        }
      };

      reader.onerror = () => {
        this._markError(fileId);
        reject(new Error("FileReader error"));
      };

      readNext();
    });
  }

  /*
   * Handle an incoming data message from the transport.
   * Dispatches to the appropriate handler based on message type.
   *
   * Wire this up: transport.on("data", (d) => transfer.handleData(d))
   */
  handleData(data: unknown): void {
    const msg = data as TransferData;

    switch (msg.type) {
      case "ping":
      case "pong":
        break;

      case "metadata":
        this._handleMetadata(msg);
        break;

      case "chunk":
        this._handleChunk(msg);
        break;

      case "end":
        this._handleEnd(msg);
        break;
    }
  }

  /*
   * Subscribe to snapshot changes. Returns an unsubscribe function.
   * The callback fires whenever a transfer progresses, completes, or errors.
   */
  subscribe(cb: (snapshots: TransferSnapshot[]) => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  /*
   * Get the current array of transfer snapshots.
   */
  getSnapshots(): TransferSnapshot[] {
    return this.snapshots;
  }

  /*
   * Mark all in-progress transfers as errored.
   * Called when the transport disconnects mid-transfer.
   */
  abortAll(): void {
    this.snapshots = this.snapshots.map((s) =>
      s.status === "sending" || s.status === "receiving"
        ? { ...s, status: "error" as const }
        : s,
    );
    this._notify();
  }

  /*
   * Clean up all accumulated state and revoke blob URLs.
   */
  destroy(): void {
    for (const s of this.snapshots) {
      if (s.url) URL.revokeObjectURL(s.url);
    }
    this.incomingChunks.clear();
    this.receivedSize.clear();
    this.incomingStartTimes.clear();
    this.snapshots = [];
    this.subscribers.clear();
  }

  /* ---- internal: receive handlers ---- */

  private _handleMetadata(msg: TransferData & { type: "metadata" }): void {
    this.incomingChunks.set(msg.id, []);
    this.receivedSize.set(msg.id, 0);
    this.incomingStartTimes.set(msg.id, Date.now());

    this._addSnapshot({
      id: msg.id,
      name: msg.name,
      size: msg.size,
      type: msg.fileType,
      progress: 0,
      status: "receiving",
    });
  }

  private _handleChunk(msg: TransferData & { type: "chunk" }): void {
    const buf = this.incomingChunks.get(msg.id);
    if (!buf) return;

    const data =
      msg.chunk instanceof Uint8Array
        ? msg.chunk
        : new Uint8Array(msg.chunk);

    buf.push(data);

    const total = (this.receivedSize.get(msg.id) ?? 0) + data.byteLength;
    this.receivedSize.set(msg.id, total);

    const meta = this.snapshots.find((s) => s.id === msg.id);
    if (!meta) return;

    const elapsed = (Date.now() - (this.incomingStartTimes.get(msg.id) ?? Date.now())) / 1000;
    const speed = elapsed > 0 ? total / elapsed : 0;

    this._updateProgress(msg.id, Math.min((total / meta.size) * 100, 99), speed);
  }

  private _handleEnd(msg: TransferData & { type: "end" }): void {
    const chunks = this.incomingChunks.get(msg.id);
    const meta = this.snapshots.find((s) => s.id === msg.id);
    if (!chunks || !meta) return;

    const blob = new Blob(chunks as BlobPart[], { type: meta.type });
    const url = URL.createObjectURL(blob);

    this.incomingChunks.delete(msg.id);
    this.receivedSize.delete(msg.id);
    this.incomingStartTimes.delete(msg.id);

    this.snapshots = this.snapshots.map((s) =>
      s.id === msg.id
        ? { ...s, progress: 100, status: "ready" as const, url }
        : s,
    );
    this._notify();
  }

  /* ---- internal: helpers ---- */

  private _addSnapshot(snapshot: TransferSnapshot): void {
    this.snapshots = [snapshot, ...this.snapshots];
    this._notify();
  }

  private _updateProgress(
    id: string,
    progress: number,
    speed?: number,
  ): void {
    this.snapshots = this.snapshots.map((s) =>
      s.id === id ? { ...s, progress, ...(speed !== undefined ? { speed } : {}) } : s,
    );
    this._notify();
  }

  private _markCompleted(id: string): void {
    this.snapshots = this.snapshots.map((s) =>
      s.id === id ? { ...s, progress: 100, status: "completed" as const } : s,
    );
    this._notify();
  }

  private _markError(id: string): void {
    this.snapshots = this.snapshots.map((s) =>
      s.id === id ? { ...s, status: "error" as const } : s,
    );
    this._notify();
  }

  private _notify(): void {
    for (const cb of this.subscribers) {
      cb(this.snapshots);
    }
  }
}
