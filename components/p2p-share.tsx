"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { Peer, type DataConnection } from "peerjs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Upload,
  Download,
  Copy,
  CheckCircle,
  X,
  Link as LinkIcon,
  FileText,
  Monitor,
  User,
  Loader2,
} from "lucide-react";

const CHUNK_SIZE = 16384; // 16KB chunks for reliable transfer

interface SharedFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "sending" | "receiving" | "completed" | "error" | "ready"; // 'ready' means downloaded to memory
  type: string;
  url?: string; // Blob URL for manual download
}

export default function P2PShare() {
  const [peerId, setPeerId] = useState<string>("");
  const [remoteId, setRemoteId] = useState<string>("");
  const [peer, setPeer] = useState<Peer | null>(null);
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Track incoming chunks by file ID
  const incomingChunks = useRef<Record<string, Uint8Array[]>>({});
  const receivedSize = useRef<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize PeerJS on mount
  useEffect(() => {
    const newPeer = new Peer();

    newPeer.on("open", (id) => {
      setPeerId(id); // Store local peer ID
      console.log("My peer ID is: " + id);
    });

    newPeer.on("connection", (conn) => {
      setupConnection(conn); // Handle incoming connection request
    });

    newPeer.on("error", (err) => {
      console.error("PeerJS error:", err); // Log any signaling errors
    });

    setPeer(newPeer); // Save peer instance

    return () => {
      newPeer.destroy();
    };
  }, []);

  // Set up connection listeners
  const setupConnection = (conn: DataConnection) => {
    setConnection(conn);

    conn.on("open", () => {
      setIsConnected(true);
      console.log("Connected to: " + conn.peer);
    });

    conn.on("data", (data: any) => {
      // Handle different types of P2P messages
      if (data.type === "metadata") {
        // Prepare to receive a new file
        const newFile: SharedFile = {
          id: data.id,
          name: data.name,
          size: data.size,
          type: data.fileType,
          progress: 0,
          status: "receiving",
        };
        setFiles((prev) => [newFile, ...prev]);
        incomingChunks.current[data.id] = []; // Initialize chunk buffer
        receivedSize.current[data.id] = 0; // Reset received size tracker
      } else if (data.type === "chunk") {
        // Collect incoming file chunks
        const { id, chunk } = data;

        if (incomingChunks.current[id]) {
          // Store actual data chunk (ensure it's not empty)
          const dataArray =
            chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
          incomingChunks.current[id].push(dataArray);
          receivedSize.current[id] += dataArray.byteLength;

          setFiles((prev) =>
            prev.map((f) => {
              if (f.id === id) {
                // Update progress based on bytes received
                const progress = Math.min(
                  (receivedSize.current[id] / f.size) * 100,
                  99,
                );
                return { ...f, progress };
              }
              return f;
            }),
          );
        }
      } else if (data.type === "end") {
        // File transfer complete, reconstruct into a single Blob
        const { id } = data;
        const chunks = incomingChunks.current[id];

        if (chunks && chunks.length > 0) {
          // Take a snapshot of the chunks to avoid race conditions with cleanup
          const finalChunks = [...chunks];

          setFiles((prev) => {
            const file = prev.find((f) => f.id === id);
            if (!file) return prev;

            const blob = new Blob(finalChunks as any, { type: file.type });
            const url = URL.createObjectURL(blob);

            // console.log(
            //   `File reconstructed: ${file.name} (${blob.size} bytes)`,
            // );

            return prev.map((f) =>
              f.id === id
                ? {
                    ...f,
                    progress: 100,
                    status: "ready",
                    url,
                  }
                : f,
            );
          });

          // Safe to cleanup ref buffers now
          delete incomingChunks.current[id];
          delete receivedSize.current[id];
        } else {
          console.error(`Received 'end' for ${id} but no chunks were found!`);
        }
      }
    });

    conn.on("close", () => {
      setIsConnected(false);
      setConnection(null);
    });
  };

  // Handle manual download trigger
  const handleDownload = (file: SharedFile) => {
    if (!file.url) return;
    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Connect to a remote peer
  const handleConnect = () => {
    if (!peer || !remoteId) return;
    const conn = peer.connect(remoteId);
    setupConnection(conn);
  };

  // Copy ID to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(peerId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Handle file selection and sending with chunking
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || !connection) return;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileId = Math.random().toString(36).substring(7);

      setFiles((prev) => [
        {
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          progress: 0,
          status: "sending",
        },
        ...prev,
      ]);

      // Send metadata
      connection.send({
        type: "metadata",
        id: fileId,
        name: file.name,
        size: file.size,
        fileType: file.type,
      });

      // Read and send the file in serialized chunks
      const reader = new FileReader();
      let offset = 0;

      const readNextChunk = () => {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        reader.readAsArrayBuffer(slice); // Read slice as binary
      };

      reader.onload = (event) => {
        if (event.target?.error) {
          console.error("FileReader error:", event.target.error);
          return;
        }

        const chunk = event.target?.result as ArrayBuffer;
        if (!chunk || chunk.byteLength === 0) {
          console.warn("Read empty chunk, skipping...");
        } else {
          // Send binary chunk over data channel
          connection.send({
            type: "chunk",
            id: fileId,
            chunk: chunk,
          });
        }

        offset += chunk?.byteLength || 0;
        const progress = (offset / file.size) * 100;
        // Update UI progress bar
        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, progress } : f)),
        );

        if (offset < file.size) {
          readNextChunk(); // Continue reading next slice
        } else {
          // All chunks sent, signify end of transfer
          connection.send({ type: "end", id: fileId });
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId ? { ...f, status: "completed" } : f,
            ),
          );
        }
      };

      readNextChunk(); // Start the chunking process
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg border-2">
      <CardHeader className="bg-muted/50">
        <CardTitle className="flex items-center gap-2">
          <Monitor className="w-6 h-6" />
          P2P File Transfer
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Connection Setup */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4" /> Your ID
            </label>
            <div className="flex gap-2">
              <Input
                value={peerId || "Generating..."}
                readOnly
                className="font-mono text-xs bg-muted"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={copyToClipboard}
                disabled={!peerId}
              >
                {isCopied ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <LinkIcon className="w-4 h-4" /> Remote Peer ID
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Paste Peer ID..."
                value={remoteId}
                onChange={(e) => setRemoteId(e.target.value)}
                disabled={isConnected}
                className="font-mono text-xs"
              />
              <Button
                onClick={handleConnect}
                disabled={isConnected || !remoteId}
              >
                {isConnected ? "Connected" : "Connect"}
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* File Area */}
        <div
          className={`
            border-2 border-dashed rounded-xl p-10 text-center transition-colors
            ${isConnected ? "cursor-pointer hover:bg-muted/50 border-primary/20" : "bg-muted/20 border-muted opacity-50 cursor-not-allowed"}
          `}
          onClick={() => isConnected && fileInputRef.current?.click()}
        >
          {/* accept only files not directories, otherwise it will break the chunking logic and cause memory leaks. */}
          <input
            type="file"
            accept="*/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
            // webkitdirectory={false}
          />
          <Upload
            className={`w-12 h-12 mx-auto mb-4 ${isConnected ? "text-primary" : "text-muted-foreground"}`}
          />
          <h3 className="text-lg font-semibold">
            {isConnected
              ? "Click to share a file"
              : "Connect to a peer to share files"}
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            Files are sent directly from your device to theirs.
          </p>
        </div>

        {/* Status indicator */}
        {isConnected && (
          <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 py-2 rounded-full border border-green-100">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              Stable P2P Connection Established
            </span>
          </div>
        )}

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Transfers
            </h4>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {files.map((file) => (
                <div key={file.id} className="p-3 border rounded-lg bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-md">
                        {file.status === "receiving" ||
                        file.status === "ready" ? (
                          <Download className="w-4 h-4 text-primary" />
                        ) : (
                          <FileText className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium truncate max-w-[150px]">
                          {file.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">
                          {(file.size / 1024 / 1024).toFixed(2)} MB •{" "}
                          {file.status === "ready" ? "Available" : file.status}
                        </div>
                      </div>
                    </div>
                    {file.status === "completed" && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {file.status === "ready" && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 gap-1 px-2"
                        onClick={() => handleDownload(file)}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Save
                      </Button>
                    )}
                    {(file.status === "sending" ||
                      file.status === "receiving") && (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    )}
                  </div>
                  <Progress value={file.progress} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="bg-muted/30 text-[10px] text-center justify-center text-muted-foreground">
        No server involved. Data stays in your browser.
      </CardFooter>
    </Card>
  );
}
