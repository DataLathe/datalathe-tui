import { createWriteStream } from "node:fs";
import { rename, chmod, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { execFile } from "node:child_process";
import http from "node:http";
import https from "node:https";
import type { IncomingMessage } from "node:http";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getHttpsAgent } from "./https-agent.js";
import { describeTlsError } from "./tls-error.js";

export interface DownloadProgress {
  binary: string;
  bytesDownloaded: number;
  totalBytes: number | null;
}

export interface DownloadOptions {
  agent?: https.Agent;
  maxRedirects?: number;
}

function requestStream(
  url: string,
  agent: https.Agent,
  redirectsLeft: number
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const isHttps = new URL(url).protocol === "https:";
    const lib = isHttps ? https : http;
    const req = lib.get(url, { agent: isHttps ? agent : undefined }, (res) => {
      const status = res.statusCode ?? 0;
      const location = res.headers.location;
      if (status >= 300 && status < 400 && location && redirectsLeft > 0) {
        res.resume();
        const next = new URL(location, url).toString();
        resolve(requestStream(next, agent, redirectsLeft - 1));
        return;
      }
      resolve(res);
    });
    req.on("error", reject);
  });
}

/**
 * Download a binary from a presigned URL, write to a temp file, then rename.
 * Sets chmod 755 and on macOS removes quarantine attribute.
 */
export async function downloadBinary(
  url: string,
  destPath: string,
  binaryName: string,
  onProgress?: (p: DownloadProgress) => void,
  options?: DownloadOptions
): Promise<void> {
  await mkdir(dirname(destPath), { recursive: true });

  const tmpPath = destPath + ".tmp";
  const agent = options?.agent ?? getHttpsAgent();
  const maxRedirects = options?.maxRedirects ?? 5;

  let res: IncomingMessage;
  try {
    res = await requestStream(url, agent, maxRedirects);
  } catch (err) {
    throw describeTlsError(err, new URL(url).host) ?? err;
  }

  const status = res.statusCode ?? 0;
  if (status < 200 || status >= 300) {
    res.resume();
    throw new Error(
      `Download failed for ${binaryName}: ${status} ${res.statusMessage ?? ""}`.trim()
    );
  }

  const totalBytes = res.headers["content-length"]
    ? parseInt(res.headers["content-length"], 10)
    : null;

  let bytesDownloaded = 0;
  let lastReport = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      bytesDownloaded += chunk.length;
      const now = Date.now();
      if (onProgress && now - lastReport > 100) {
        lastReport = now;
        onProgress({ binary: binaryName, bytesDownloaded, totalBytes });
      }
      cb(null, chunk);
    },
  });

  await pipeline(res, counter, createWriteStream(tmpPath));

  onProgress?.({ binary: binaryName, bytesDownloaded, totalBytes });

  await rename(tmpPath, destPath);
  await chmod(destPath, 0o755);

  if (process.platform === "darwin") {
    await new Promise<void>((resolve) => {
      execFile("xattr", ["-d", "com.apple.quarantine", destPath], () => resolve());
    });
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
