import { describe, it, expect } from "vitest";
import { describeTlsError } from "../src/utils/tls-error.js";

describe("describeTlsError", () => {
  it("returns an actionable message for an untrusted-issuer error", () => {
    const err = Object.assign(new Error("unable to get local issuer certificate"), {
      code: "UNABLE_TO_GET_ISSUER_CERT_LOCAL",
    });
    const result = describeTlsError(err, "datalathe-releases.s3.us-west-1.amazonaws.com");
    expect(result).toBeInstanceOf(Error);
    expect(result?.message).toContain("datalathe-releases.s3.us-west-1.amazonaws.com");
    expect(result?.message).toContain("UNABLE_TO_GET_ISSUER_CERT_LOCAL");
    expect(result?.message).toContain("DATALATHE_CA_BUNDLE");
  });

  it("recognizes a self-signed chain error", () => {
    const err = Object.assign(new Error("self signed certificate in chain"), {
      code: "SELF_SIGNED_CERT_IN_CHAIN",
    });
    expect(describeTlsError(err, "license.datalathe.com")).toBeInstanceOf(Error);
  });

  it("returns null for a non-TLS error so the caller keeps the original", () => {
    const err = Object.assign(new Error("connection reset"), {
      code: "ECONNRESET",
    });
    expect(describeTlsError(err, "license.datalathe.com")).toBeNull();
  });

  it("returns null when the error has no code", () => {
    expect(describeTlsError(new Error("boom"), "license.datalathe.com")).toBeNull();
  });
});
