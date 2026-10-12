"use client";

/*
 * Drop It — P2P File Sharing Component
 * ======================================
 *
 * Architecture
 * ------------
 * This component is a thin orchestrator over two deepened modules:
 *
 *   lib/types.ts           — Transport interface, protocol types, CHUNK_SIZE
 *   lib/transport-peerjs.ts — PeerJSTransport (PeerJS behind the Transport seam)
 *   lib/chunked-transfer.ts — ChunkedTransfer (file protocol + state)
 *
 * The component:
 *   1. Creates a PeerJSTransport and a ChunkedTransfer on mount.
 *   2. Wires transport events to transfer handlers.
 *   3. Subscribes to transfer snapshots for rendering.
 *   4. Handles user interactions (connect, send file, download, copy link).
 *
 * All protocol logic, chunk accumulation, and connection heartbeat live in
 * the deepened modules — this file owns only orchestration and JSX.
 */

import type React from "react";
import { useState, useRef, useEffect } from "react";
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
  CheckCircle,
  Link as LinkIcon,
  FileText,
  Monitor,
  User,
  Loader2,
  Link,
} from "lucide-react";
import { PeerJSTransport } from "@/lib/transport-peerjs";
import { ChunkedTransfer } from "@/lib/chunked-transfer";
import type { TransferSnapshot } from "@/lib/types";

export default function P2PShare() {
  const [peerId, setPeerId] = useState<string>("");
  const [remoteId, setRemoteId] = useState<string>("");
  const [files, setFiles] = useState<TransferSnapshot[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isDisconnectedInMidTransfer, setIsDisconnectedInMidTransfer] =
    useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const transportRef = useRef<PeerJSTransport | null>(null);
  const transferRef = useRef<ChunkedTransfer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /*
   * Effect: initialise transport + transfer protocol on mount.
   *
   * Creates the PeerJSTransport (wraps PeerJS) and ChunkedTransfer (file
   * protocol), wires events, and subscribes to snapshot updates. Cleans up
   * both on unmount.
   */
  useEffect(() => {
    const transport = new PeerJSTransport();
    const transfer = new ChunkedTransfer();
    transportRef.current = transport;
    transferRef.current = transfer;

    transport.on("peer-id", (id: string) => {
      setPeerId(id);

      // Auto-connect if the URL contains ?peerId=XXX
      const urlParams = new URLSearchParams(window.location.search);
      const urlPeerId = urlParams.get("peerId");
      if (urlPeerId) {
        transport.connect(urlPeerId);
      }
    });

    transport.on("connected", () => {
      setIsConnected(true);
      setIsDisconnectedInMidTransfer(false);
    });

    transport.on("data", (data: unknown) => {
      transfer.handleData(data);
    });

    transport.on("disconnected", () => {
      setIsConnected(false);
      // Check if any transfers were in flight when we lost the connection
      const hadActive = transfer
        .getSnapshots()
        .some((s) => s.status === "sending" || s.status === "receiving");
      if (hadActive) {
        setIsDisconnectedInMidTransfer(true);
      }
      transfer.abortAll();
    });

    transport.on("error", (err: Error) => {
      console.error("Transport error:", err);
    });

    transfer.subscribe(setFiles);

    return () => {
      transfer.destroy();
      transport.destroy();
    };
  }, []);

  const handleConnect = () => {
    if (!transportRef.current || !remoteId) return;
    transportRef.current.connect(remoteId);
  };

  /*
   * handleFileChange — Send selected files over the transport.
   *
   * Uses the ChunkedTransfer to handle chunking, sending, and progress
   * tracking. Errors from a dropped connection are caught silently since
   * the transfer already updates its own state to "error" on disconnect.
   */
  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles = e.target.files;
    const transport = transportRef.current;
    const transfer = transferRef.current;
    if (!selectedFiles || !transport || !transfer) return;

    for (let i = 0; i < selectedFiles.length; i++) {
      try {
        await transfer.sendFile(transport, selectedFiles[i]);
      } catch {
        // Transfer state already updated by abortAll on disconnect
      }
    }
  };

  const handleDownload = (file: TransferSnapshot) => {
    if (!file.url) return;
    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(peerId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCopyLink = () => {
    const id = transportRef.current?.peerId;
    if (!id) return;
    const shareUrl = `${window.location.origin}/?peerId=${id}`;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch((error: Error) => {
        console.error("Failed to copy share link:", error);
        setIsCopied(false);
      });
  };

  /*
   * Derive the current connection speed from the first active transfer.
   */
  const activeTransfer = files.find(
    (f) => f.status === "sending" || f.status === "receiving",
  );
  const connSpeed = activeTransfer?.speed ?? null;

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg border-2">
      <CardHeader className="flex flex-row bg-muted/50">
        <CardTitle className="gap-2 flex items-center">
          <Monitor className="w-6 h-6" />
          P2P File Transfer
        </CardTitle>
        <CardTitle className="ml-auto gap-2">
          {isCopied ? (
            <div className="flex items-center gap-1 text-sm text-primary">
              <span>Link Copied</span>{" "}
              <CheckCircle className="w-4 h-4 text-primary" />
            </div>
          ) : (
            <button
              onClick={handleCopyLink}
              disabled={!peerId}
              className="flex items-center cursor-pointer gap-1 text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Link className="w-4 h-4" />
              Share Link
            </button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
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

        <div
          className={`
            border-2 border-dashed rounded-xl p-10 text-center transition-colors
            ${isConnected ? "cursor-pointer hover:bg-muted/50 border-primary/20" : "bg-muted/20 border-muted opacity-50 cursor-not-allowed"}
          `}
          onClick={() => isConnected && fileInputRef.current?.click()}
        >
          <input
            type="file"
            accept="*/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
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

        {isConnected && (
          <div className="flex items-center justify-center gap-2 text-primary bg-primary/10 py-2 rounded-full border border-primary/20">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              Stable P2P Connection Established
            </span>
          </div>
        )}
        {isDisconnectedInMidTransfer && (
          <div className="flex items-center justify-center gap-2 text-destructive bg-destructive/10 py-2 rounded-full border border-destructive/20">
            <span className="text-sm px-2 m-2 font-medium">
              Connection Lost During Transfer. May be your peer disconnected or
              network dropped. Please try again.
            </span>
          </div>
        )}
        {connSpeed !== null && (
          <div className="flex items-center justify-center gap-2 text-foreground bg-muted py-2 rounded-full border border-border">
            <span className="text-sm px-2 m-2 font-medium">
              Current Transfer Speed: {(connSpeed / 1024).toFixed(2)} KB/s
            </span>
          </div>
        )}

        {files.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Transfers
            </h4>
            <div className="space-y-2 max-h-75 overflow-y-auto pr-2">
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
                        <div className="text-sm font-medium truncate max-w-37.5">
                          {file.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">
                          {(file.size / 1024 / 1024).toFixed(2)} MB •{" "}
                          {file.status === "ready" ? "Available" : file.status}
                        </div>
                      </div>
                    </div>
                    {file.status === "completed" && (
                      <CheckCircle className="w-5 h-5 text-primary" />
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
