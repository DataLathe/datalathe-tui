import { describe, it, expect, afterEach } from "vitest";
import https from "node:https";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { postJson } from "../src/utils/license-api.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const TEST_CERT = readFileSync(join(fixtures, "test-cert.pem"), "utf8");
const TEST_KEY = readFileSync(join(fixtures, "test-key.pem"), "utf8");

const servers: https.Server[] = [];

function listen(server: https.Server): Promise<number> {
  servers.push(server);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () =>
      resolve((server.address() as { port: number }).port)
    );
  });
}

afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

describe("postJson", () => {
  it("returns parsed JSON when the server certificate is trusted", async () => {
    const port = await listen(
      https.createServer({ cert: TEST_CERT, key: TEST_KEY }, (_req, res) => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ versions: ["1.0.0"] }));
      })
    );
    const { status, data } = await postJson(
      { host: "127.0.0.1", port, agent: new https.Agent({ ca: [TEST_CERT] }) },
      "/downloads/versions",
      { licenseKey: "k" }
    );
    expect(status).toBe(200);
    expect(data).toEqual({ versions: ["1.0.0"] });
  });

  it("rejects with an actionable TLS error when the certificate is untrusted", async () => {
    const port = await listen(
      https.createServer({ cert: TEST_CERT, key: TEST_KEY }, (_req, res) => {
        res.end("{}");
      })
    );
    await expect(
      postJson(
        { host: "127.0.0.1", port, agent: new https.Agent() },
        "/downloads/versions",
        { licenseKey: "k" }
      )
    ).rejects.toThrow(/TLS certificate validation failed/);
  });
});
