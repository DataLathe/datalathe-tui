import { createWriteStream } from "node:fs";
import { rename, chmod, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { execFile } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export interface DownloadProgress {
  binary: string;
  bytesDownloaded: number;
  totalBytes: number | null;
}

/**
 * Download a binary from a presigned URL, write to a temp file, then rename.
 * Sets chmod 755 and on macOS removes quarantine attribute.
 */
export async function downloadBinary(
  url: string,
  destPath: string,
  binaryName: string,
  onProgress?: (p: DownloadProgress) => void
): Promise<void> {
  await mkdir(dirname(destPath), { recursive: true });

  const tmpPath = destPath + ".tmp";
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(
      `Download failed for ${binaryName}: ${res.status} ${res.statusText}`
    );
  }

  const totalBytes = res.headers.get("content-length")
    ? parseInt(res.headers.get("content-length")!, 10)
    : null;

  let bytesDownloaded = 0;
  let lastReport = 0;

  const body = res.body;
  if (!body) {
    throw new Error(`No response body for ${binaryName}`);
  }

  const writeStream = createWriteStream(tmpPath);

  // Convert web ReadableStream to Node Readable and track progress
  const reader = body.getReader();
  const nodeStream = new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
        return;
      }
      bytesDownloaded += value.byteLength;
      // Throttle progress to every 100ms
      const now = Date.now();
      if (onProgress && now - lastReport > 100) {
        lastReport = now;
        onProgress({ binary: binaryName, bytesDownloaded, totalBytes });
      }
      this.push(Buffer.from(value));
    },
  });

  await pipeline(nodeStream, writeStream);

  // Final progress report
  onProgress?.({ binary: binaryName, bytesDownloaded, totalBytes });

  // Atomic rename
  await rename(tmpPath, destPath);

  // Make executable
  await chmod(destPath, 0o755);

  // macOS: remove quarantine attribute
  if (process.platform === "darwin") {
    try {
      await new Promise<void>((resolve, reject) => {
        execFile(
          "xattr",
          ["-d", "com.apple.quarantine", destPath],
          (err) => {
            // Ignore error if attribute doesn't exist
            resolve();
          }
        );
      });
    } catch {
      // Ignore xattr errors
    }
  }
}

/**
 * Format bytes into a human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
