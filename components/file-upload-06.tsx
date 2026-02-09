"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Upload, FileText, X, CheckCircle, Loader2 } from "lucide-react";

interface UploadItem {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "completed";
}

export default function FileUpload06({
  uploads: initialUploads,
}: {
  uploads?: UploadItem[];
}) {
  const [uploads, setUploads] = useState<UploadItem[]>(
    initialUploads || [
      {
        id: "a1",
        name: "design-mock-landing.png",
        progress: 62,
        status: "uploading",
      },
      {
        id: "c3",
        name: "logo-v3-final.gif",
        progress: 100,
        status: "completed",
      },
    ],
  );
  const filePickerRef = useRef<HTMLInputElement>(null);

  const openFilePicker = () => {
    filePickerRef.current?.click();
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setUploads((prev) => {
        const hasUploading = prev.some(
          (f) => f.status === "uploading" && f.progress < 100,
        );
        if (!hasUploading) return prev;

        return prev.map((file) => {
          if (file.status === "uploading" && file.progress < 100) {
            const increment = Math.floor(Math.random() * 10) + 5;
            const newProgress = Math.min(file.progress + increment, 100);
            return {
              ...file,
              progress: newProgress,
              status: newProgress === 100 ? "completed" : "uploading",
            };
          }
          return file;
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;

    // TODO: Implement actual file upload to server
    // 1. Create FormData
    // 2. Send POST request to API endpoint
    // 3. Track progress using XHR or Fetch with ReadableStream

    const newFiles = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      progress: 0,
      status: "uploading" as const,
    }));

    setUploads((prev) => [...newFiles, ...prev]);
  };

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(event.target.files);
  };

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const onDropFiles = (event: React.DragEvent) => {
    event.preventDefault();
    handleFileUpload(event.dataTransfer.files);
  };

  const removeUploadById = (id: string) => {
    setUploads(uploads.filter((file) => file.id !== id));
  };

  const activeUploads = uploads.filter((file) => file.status === "uploading");
  const completedUploads = uploads.filter(
    (file) => file.status === "completed",
  );

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-y-6">
      <Card
        className="group flex max-h-[200px] w-full flex-col items-center justify-center gap-4 py-8 border-dashed text-sm cursor-pointer hover:bg-muted/50 transition-colors"
        onDragOver={onDragOver}
        onDrop={onDropFiles}
        onClick={openFilePicker}
      >
        <div className="grid space-y-3">
          <div className="flex items-center gap-x-2 text-muted-foreground">
            <Upload className="size-5" />
            <div>
              Drop files here or{" "}
              <Button
                variant="link"
                className="text-primary p-0 h-auto font-normal"
                onClick={openFilePicker}
              >
                browse files
              </Button>{" "}
              to add
            </div>
          </div>
        </div>
        <input
          ref={filePickerRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/gif"
          multiple
          onChange={onFileInputChange}
        />
        <span className="text-base/6 text-muted-foreground group-disabled:opacity-50 mt-2 block sm:text-xs">
          Supported: JPG, PNG, GIF (max 10 MB)
        </span>
      </Card>

      <div className="flex flex-col gap-y-4">
        {activeUploads.length > 0 && (
          <div>
            <h2 className="text-balance text-foreground text-lg flex items-center font-mono font-normal uppercase sm:text-xs mb-4">
              <Loader2 className="size-4 mr-1 animate-spin" />
              Uploading
            </h2>
            <div className="-mt-2 divide-y">
              {activeUploads.map((file) => (
                <div key={file.id} className="group flex items-center py-4">
                  <div className="mr-3 grid size-10 shrink-0 place-content-center rounded border bg-muted">
                    <FileText className="inline size-4 group-hover:hidden" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden size-4 group-hover:inline p-0 h-auto"
                      onClick={() => removeUploadById(file.id)}
                      aria-label="Cancel"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <div className="flex flex-col w-full mb-1">
                    <div className="flex justify-between gap-2">
                      <span className="select-none text-base/6 text-foreground group-disabled:opacity-50 sm:text-sm/6">
                        {file.name}
                      </span>
                      <span className="text-muted-foreground text-sm tabular-nums">
                        {file.progress}%
                      </span>
                    </div>
                    <Progress
                      value={file.progress}
                      className="mt-1 h-2 min-w-64"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeUploads.length > 0 && completedUploads.length > 0 && (
          <Separator className="my-0" />
        )}

        {completedUploads.length > 0 && (
          <div>
            <h2 className="text-balance text-foreground text-lg flex items-center font-mono font-normal uppercase sm:text-xs mb-4">
              <CheckCircle className="mr-1 size-4" />
              Finished
            </h2>
            <div className="-mt-2 divide-y">
              {completedUploads.map((file) => (
                <div key={file.id} className="group flex items-center py-4">
                  <div className="mr-3 grid size-10 shrink-0 place-content-center rounded border bg-muted">
                    <FileText className="inline size-4 group-hover:hidden" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden size-4 group-hover:inline p-0 h-auto"
                      onClick={() => removeUploadById(file.id)}
                      aria-label="Remove"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <div className="flex flex-col w-full mb-1">
                    <div className="flex justify-between gap-2">
                      <span className="select-none text-base/6 text-foreground group-disabled:opacity-50 sm:text-sm/6">
                        {file.name}
                      </span>
                      <span className="text-muted-foreground text-sm tabular-nums">
                        {file.progress}%
                      </span>
                    </div>
                    <Progress
                      value={file.progress}
                      className="mt-1 h-2 min-w-64"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Button variant="outline" className="w-full" onClick={openFilePicker}>
        Select Files to Upload
      </Button>
    </div>
  );
}
