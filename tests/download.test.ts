import { describe, it, expect, afterEach } from "vitest";
import http from "node:http";
import https from "node:https";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { downloadBinary, type DownloadProgress } from "../src/utils/download.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const TEST_CERT = readFileSync(join(fixtures, "test-cert.pem"), "utf8");
const TEST_KEY = readFileSync(join(fixtures, "test-key.pem"), "utf8");

const BINARY = Buffer.from("#!/bin/sh\necho datalathe-engine\n".repeat(2000));

const servers: Array<http.Server | https.Server> = [];

function listen(server: http.Server | https.Server): Promise<number> {
  servers.push(server);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve((server.address() as { port: number }).port);
    });
  });
}

function tmpDest(): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "dl-test-"));
  return { dir, path: join(dir, "engine") };
}

afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

describe("downloadBinary", () => {
  it("downloads the body to the destination path", async () => {
    const port = await listen(
      http.createServer((_req, res) => {
        res.setHeader("content-length", String(BINARY.length));
        res.end(BINARY);
      })
    );
    const { dir, path } = tmpDest();
    try {
      await downloadBinary(`http://127.0.0.1:${port}/engine`, path, "engine");
      expect(await readFile(path)).toEqual(BINARY);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports progress with total bytes from content-length", async () => {
    const port = await listen(
      http.createServer((_req, res) => {
        res.setHeader("content-length", String(BINARY.length));
        res.end(BINARY);
      })
    );
    const { dir, path } = tmpDest();
    const updates: DownloadProgress[] = [];
    try {
      await downloadBinary(`http://127.0.0.1:${port}/engine`, path, "engine", (p) =>
        updates.push(p)
      );
      const last = updates.at(-1)!;
      expect(last.binary).toBe("engine");
      expect(last.totalBytes).toBe(BINARY.length);
      expect(last.bytesDownloaded).toBe(BINARY.length);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("follows redirects", async () => {
    const origin = await listen(
      http.createServer((_req, res) => {
        res.end(BINARY);
      })
    );
    const port = await listen(
      http.createServer((_req, res) => {
        res.writeHead(302, { location: `http://127.0.0.1:${origin}/real` });
        res.end();
      })
    );
    const { dir, path } = tmpDest();
    try {
      await downloadBinary(`http://127.0.0.1:${port}/redirect`, path, "engine");
      expect(await readFile(path)).toEqual(BINARY);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws a descriptive error on a non-2xx status", async () => {
    const port = await listen(
      http.createServer((_req, res) => {
        res.writeHead(404);
        res.end("nope");
      })
    );
    const { dir, path } = tmpDest();
    try {
      await expect(
        downloadBinary(`http://127.0.0.1:${port}/missing`, path, "engine")
      ).rejects.toThrow(/Download failed for engine: 404/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("succeeds over HTTPS when the server's CA is trusted", async () => {
    const port = await listen(
      https.createServer({ cert: TEST_CERT, key: TEST_KEY }, (_req, res) => {
        res.end(BINARY);
      })
    );
    const { dir, path } = tmpDest();
    try {
      await downloadBinary(`https://localhost:${port}/engine`, path, "engine", undefined, {
        agent: new https.Agent({ ca: [TEST_CERT] }),
      });
      expect(await readFile(path)).toEqual(BINARY);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("surfaces an actionable TLS error when the CA is not trusted", async () => {
    const port = await listen(
      https.createServer({ cert: TEST_CERT, key: TEST_KEY }, (_req, res) => {
        res.end(BINARY);
      })
    );
    const { dir, path } = tmpDest();
    try {
      await expect(
        downloadBinary(`https://localhost:${port}/engine`, path, "engine", undefined, {
          agent: new https.Agent(),
        })
      ).rejects.toThrow(/TLS certificate validation failed.*DATALATHE_CA_BUNDLE/s);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
