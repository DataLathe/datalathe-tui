import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import tls from "node:tls";

const LINUX_CA_BUNDLE_PATHS = [
  "/etc/ssl/certs/ca-certificates.crt",
  "/etc/pki/tls/certs/ca-bundle.crt",
  "/etc/ssl/ca-bundle.pem",
];

// `null` is the default keychain search list (login + System + any admin- or
// MDM-installed keychains, where corporate roots like Zscaler typically land);
// the explicit path adds the built-in system roots, which the search list omits.
const MACOS_CERT_SOURCES: Array<string | null> = [
  null,
  "/System/Library/Keychains/SystemRootCertificates.keychain",
];

export interface CABundleParts {
  bundledRoots: readonly string[];
  systemCerts: () => string[];
  envCerts: () => string[];
}

export function buildCABundle(parts: CABundleParts): string[] {
  const certs: string[] = [...parts.bundledRoots];
  for (const loader of [parts.systemCerts, parts.envCerts]) {
    try {
      certs.push(...loader());
    } catch {
      // Resilient: a missing file or unavailable tool must never block startup.
    }
  }
  return certs;
}

export function readEnvBundle(
  env: NodeJS.ProcessEnv,
  readFile: (path: string) => string
): string[] {
  const certs: string[] = [];
  for (const key of ["DATALATHE_CA_BUNDLE", "NODE_EXTRA_CA_CERTS"]) {
    const path = env[key];
    if (path) certs.push(readFile(path));
  }
  return certs;
}

export interface SystemCertDeps {
  runSecurity: (keychain: string | null) => string;
  readFirstFile: (paths: string[]) => string | null;
}

export function loadSystemCerts(
  platform: NodeJS.Platform,
  deps: SystemCertDeps
): string[] {
  if (platform === "darwin") {
    return MACOS_CERT_SOURCES.map((source) => deps.runSecurity(source));
  }
  if (platform === "linux") {
    const bundle = deps.readFirstFile(LINUX_CA_BUNDLE_PATHS);
    return bundle ? [bundle] : [];
  }
  return [];
}

let cached: string[] | null = null;

export function getCABundle(): string[] {
  if (cached) return cached;
  cached = buildCABundle({
    bundledRoots: tls.rootCertificates,
    systemCerts: () =>
      loadSystemCerts(process.platform, {
        runSecurity: (keychain) =>
          execFileSync(
            "security",
            ["find-certificate", "-a", "-p", ...(keychain ? [keychain] : [])],
            { encoding: "utf8" }
          ),
        readFirstFile: (paths) => {
          for (const path of paths) {
            try {
              return readFileSync(path, "utf8");
            } catch {
              // try next candidate
            }
          }
          return null;
        },
      }),
    envCerts: () =>
      readEnvBundle(process.env, (path) => readFileSync(path, "utf8")),
  });
  return cached;
}
