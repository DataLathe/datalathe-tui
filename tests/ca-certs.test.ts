import { describe, it, expect } from "vitest";
import {
  buildCABundle,
  readEnvBundle,
  loadSystemCerts,
} from "../src/utils/ca-certs.js";

describe("buildCABundle", () => {
  it("combines bundled roots, system certs, and env certs in order", () => {
    const bundle = buildCABundle({
      bundledRoots: ["ROOT"],
      systemCerts: () => ["SYSTEM"],
      envCerts: () => ["ENV"],
    });
    expect(bundle).toEqual(["ROOT", "SYSTEM", "ENV"]);
  });

  it("still returns the other sources when system cert loading throws", () => {
    const bundle = buildCABundle({
      bundledRoots: ["ROOT"],
      systemCerts: () => {
        throw new Error("security unavailable");
      },
      envCerts: () => ["ENV"],
    });
    expect(bundle).toEqual(["ROOT", "ENV"]);
  });

  it("still returns the other sources when env cert loading throws", () => {
    const bundle = buildCABundle({
      bundledRoots: ["ROOT"],
      systemCerts: () => ["SYSTEM"],
      envCerts: () => {
        throw new Error("missing file");
      },
    });
    expect(bundle).toEqual(["ROOT", "SYSTEM"]);
  });
});

describe("readEnvBundle", () => {
  it("returns nothing when neither variable is set", () => {
    expect(readEnvBundle({}, () => "X")).toEqual([]);
  });

  it("reads the file named by DATALATHE_CA_BUNDLE", () => {
    const read = (p: string) => `CERT(${p})`;
    expect(readEnvBundle({ DATALATHE_CA_BUNDLE: "/corp.pem" }, read)).toEqual([
      "CERT(/corp.pem)",
    ]);
  });

  it("reads the file named by NODE_EXTRA_CA_CERTS", () => {
    const read = (p: string) => `CERT(${p})`;
    expect(
      readEnvBundle({ NODE_EXTRA_CA_CERTS: "/extra.pem" }, read)
    ).toEqual(["CERT(/extra.pem)"]);
  });

  it("reads both files when both variables are set", () => {
    const read = (p: string) => `CERT(${p})`;
    expect(
      readEnvBundle(
        { DATALATHE_CA_BUNDLE: "/corp.pem", NODE_EXTRA_CA_CERTS: "/extra.pem" },
        read
      )
    ).toEqual(["CERT(/corp.pem)", "CERT(/extra.pem)"]);
  });
});

describe("loadSystemCerts", () => {
  it("reads the default search list and the system roots via security on darwin", () => {
    const sources: Array<string | null> = [];
    const certs = loadSystemCerts("darwin", {
      runSecurity: (source) => {
        sources.push(source);
        return `CERTS(${source ?? "search-list"})`;
      },
      readFirstFile: () => null,
    });
    expect(certs).toEqual([
      "CERTS(search-list)",
      "CERTS(/System/Library/Keychains/SystemRootCertificates.keychain)",
    ]);
    expect(sources).toEqual([
      null,
      "/System/Library/Keychains/SystemRootCertificates.keychain",
    ]);
  });

  it("reads the first available CA bundle path on linux", () => {
    const certs = loadSystemCerts("linux", {
      runSecurity: () => "UNUSED",
      readFirstFile: (paths) => {
        expect(paths).toContain("/etc/ssl/certs/ca-certificates.crt");
        return "LINUX_BUNDLE";
      },
    });
    expect(certs).toEqual(["LINUX_BUNDLE"]);
  });

  it("returns nothing on linux when no bundle path exists", () => {
    const certs = loadSystemCerts("linux", {
      runSecurity: () => "UNUSED",
      readFirstFile: () => null,
    });
    expect(certs).toEqual([]);
  });

  it("returns nothing on unsupported platforms", () => {
    const certs = loadSystemCerts("win32", {
      runSecurity: () => "UNUSED",
      readFirstFile: () => "UNUSED",
    });
    expect(certs).toEqual([]);
  });
});
