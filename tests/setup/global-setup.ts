import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures"
);

export default function setup(): void {
  const cert = join(fixturesDir, "test-cert.pem");
  const key = join(fixturesDir, "test-key.pem");
  if (existsSync(cert) && existsSync(key)) return;

  mkdirSync(fixturesDir, { recursive: true });
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", key,
    "-out", cert,
    "-days", "3650",
    "-subj", "/CN=localhost",
    "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ]);
}
