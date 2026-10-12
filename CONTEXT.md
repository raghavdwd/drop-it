# drop-it — Domain Model

## Core Concepts

### Transport
A **Transport** is a seam between the application and the peer-to-peer networking layer. It abstracts over transport protocols (WebRTC via PeerJS, WebSocket, etc.) behind a single event-driven interface. The transport owns connection lifecycle, heartbeat (liveness detection), and message delivery. See `lib/types.ts` for the interface definition.

- **PeerJSTransport** (`lib/transport-peerjs.ts`): concrete implementation using PeerJS/WebRTC.
- Seam justifies the **adapter** pattern: one transport is hypothetical, two make it real. Designing for multiple transports from day one avoids interface churn.

### ChunkedTransfer
A **ChunkedTransfer** owns the file transfer wire protocol — metadata framing, binary chunking (16 KB), reassembly, and progress tracking. It is transport-agnostic: it receives a `Transport` to send files and expects data forwarded from the transport's `data` event.

- Sender: `metadata(name, size, type) → chunk(data) × N → end`
- Receiver: `metadata ← chunk(data) × N ← end → assemble Blob`
- Owns all accumulation state (`incomingChunks`, `receivedSize`, timing) that previously lived in React refs.

### TransferSnapshot
An immutable value object representing the current state of one file transfer. The UI subscribes to snapshot arrays and renders declaratively — it never mutates transfer state directly.

## Architecture Vocabulary

- **Module depth**: the ratio of interface simplicity to implementation complexity. The three new modules (`types`, `transport-peerjs`, `chunked-transfer`) are deeper than the original monolith because each has a small surface area but captures real protocol/transport complexity.
- **Seam**: the `Transport` interface creates a seam between the app and PeerJS. A `FakeTransport` (not yet built) would make the seam real.
- **Locality**: all transport lifecycle logic lives in `PeerJSTransport`; all transfer protocol logic lives in `ChunkedTransfer`. The component orchestrates — it never reaches into the protocol internals.
- **Deletion test**: deleting `lib/chunked-transfer.ts` or `lib/transport-peerjs.ts` would force the component to reimplement their logic inline — complexity concentrates. Passing the deletion test is the signal of a deepened module.

## File Layout

| File | Role |
|------|------|
| `lib/types.ts` | Transport interface, protocol types, CHUNK_SIZE |
| `lib/transport-peerjs.ts` | PeerJS transport implementation |
| `lib/chunked-transfer.ts` | File transfer protocol + state |
| `components/p2p-share.tsx` | Orchestrator — creates transport + transfer, wires events, renders |
