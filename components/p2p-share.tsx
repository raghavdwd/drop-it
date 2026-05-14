"use client";

import type React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Peer, type DataConnection } from "peerjs";
import { useTheme } from "next-themes";
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
  Link,
  Moon,
  Sun,
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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
  const setupConnection = useCallback((conn: DataConnection) => {
    setConnection(conn);

    conn.on("open", () => {
      setIsConnected(true);
      console.log("Connected to: " + conn.peer);
    });

    /**
     * Handle incoming data messages:
     * - "metadata": Initialize a new file transfer with its details.
     * - "chunk": Append incoming binary data to the corresponding file buffer and update progress.
     * - "end": Finalize the file by creating a Blob from the collected chunks and generate a download URL.
     * This structured approach allows for efficient handling of large files without overwhelming memory, while providing real-time progress updates to the user.
     */

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
  }, []);

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

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/?peerId=${peerId}`;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch((error) => {
        console.error("Failed to copy share link:", error);
        setIsCopied(false);
      });
  };

  useEffect(() => {
    // Check for peerId in URL to auto-connect
    const urlParams = new URLSearchParams(window.location.search);
    const urlPeerId = urlParams.get("peerId");
    if (urlPeerId && peer) {
      setRemoteId(urlPeerId);
      const conn = peer.connect(urlPeerId);
      setupConnection(conn);
    }
  }, [peer, setupConnection]);

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-sm border border-border/50 bg-card/30 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7 bg-transparent">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/5 rounded-full">
            <Monitor className="w-5 h-5 text-primary/70" />
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight">
            Drop It
          </CardTitle>
        </div>
        <div className="flex items-center gap-3">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full w-9 h-9"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Sun className="h-[1.1rem] w-[1.1rem]" />
              ) : (
                <Moon className="h-[1.1rem] w-[1.1rem]" />
              )}
            </Button>
          )}
          {isCopied ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 text-[11px] font-medium text-green-600 dark:text-green-400 border border-green-500/20">
              <CheckCircle className="w-3 h-3" />
              <span>Copied</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              disabled={!peerId || peerId === "Generating..."}
              className="rounded-full h-8 text-[11px] font-medium gap-1.5 px-4"
            >
              <Link className="w-3 h-3" />
              Share Link
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-10 pt-4">
        {/* Connection Setup */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 px-1">
              Your Identifier
            </label>
            <div className="relative group">
              <Input
                value={peerId || "Generating..."}
                readOnly
                className="font-mono text-xs bg-muted/30 border-none rounded-xl h-11 px-4 focus-visible:ring-1 focus-visible:ring-primary/20 transition-all"
              />
              <button 
                onClick={copyToClipboard}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-primary/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 px-1">
              Remote Peer
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter Peer ID..."
                value={remoteId}
                onChange={(e) => setRemoteId(e.target.value)}
                disabled={isConnected}
                className="font-mono text-xs bg-muted/30 border-none rounded-xl h-11 px-4 focus-visible:ring-1 focus-visible:ring-primary/20 transition-all"
              />
              <Button
                onClick={handleConnect}
                disabled={isConnected || !remoteId}
                className="rounded-xl h-11 px-6 font-medium shadow-sm transition-all active:scale-95"
              >
                {isConnected ? "Live" : "Connect"}
              </Button>
            </div>
          </div>
        </div>

        {/* File Area */}
        <div
          className={`
            relative overflow-hidden group
            border-2 border-dashed rounded-3xl p-16 text-center transition-all duration-300
            ${isConnected 
              ? "cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] border-primary/10" 
              : "bg-muted/10 border-muted/50 opacity-40 cursor-not-allowed"}
          `}
          onClick={() => isConnected && fileInputRef.current?.click()}
        >
          <div className="relative z-10">
            <div className={`
              w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center transition-colors
              ${isConnected ? "bg-primary/5 text-primary" : "bg-muted text-muted-foreground"}
            `}>
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium tracking-tight">
              {isConnected
                ? "Send something new"
                : "Awaiting connection"}
            </h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-[240px] mx-auto leading-relaxed">
              {isConnected 
                ? "Click to browse or drop files here for direct transfer."
                : "Once connected, you can share files of any size."}
            </p>
          </div>
          
          <input
            type="file"
            accept="*/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
          />
        </div>

        {/* Status indicator */}
        {isConnected && (
          <div className="flex items-center justify-center gap-2 text-primary/80 bg-primary/5 py-2.5 rounded-2xl border border-primary/10 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[12px] font-medium tracking-wide">
              Secure P2P Channel Active
            </span>
          </div>
        )}

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-5 animate-in fade-in duration-700">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">
                Active Transfers
              </h4>
              <span className="text-[10px] font-medium text-muted-foreground/50">
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </span>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {files.map((file) => (
                <div key={file.id} className="group p-4 rounded-2xl border border-border/40 bg-card/50 hover:bg-card hover:border-border/80 transition-all duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        {file.status === "receiving" ||
                        file.status === "ready" ? (
                          <Download className="w-4.5 h-4.5 text-primary/70" />
                        ) : (
                          <FileText className="w-4.5 h-4.5 text-primary/70" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium truncate max-w-[200px] md:max-w-[300px]">
                          {file.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                          <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                          <span className={file.status === "ready" ? "text-green-500/80" : ""}>
                            {file.status === "ready" ? "Completed" : file.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status === "completed" && (
                        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-green-500/70" />
                        </div>
                      )}
                      {file.status === "ready" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-9 rounded-xl gap-2 px-4 shadow-sm hover:bg-primary hover:text-primary-foreground transition-all"
                          onClick={() => handleDownload(file)}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="text-xs">Save</span>
                        </Button>
                      )}
                      {(file.status === "sending" ||
                        file.status === "receiving") && (
                        <div className="text-[11px] font-mono font-medium text-primary/70">
                          {Math.round(file.progress)}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="relative h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                    <div 
                      className="absolute top-0 left-0 h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="py-8 text-[10px] font-medium uppercase tracking-[0.2em] text-center justify-center text-muted-foreground/40">
        Encrypted P2P • No Cloud • Total Privacy
      </CardFooter>
    </Card>
  );
}
