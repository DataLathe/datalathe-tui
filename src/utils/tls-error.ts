const TLS_CERT_ERROR_CODES = new Set([
  "UNABLE_TO_GET_ISSUER_CERT_LOCAL",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "CERT_HAS_EXPIRED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

export function describeTlsError(err: unknown, host: string): Error | null {
  const code = (err as { code?: string })?.code;
  if (!code || !TLS_CERT_ERROR_CODES.has(code)) return null;
  return new Error(
    `TLS certificate validation failed for ${host} (${code}). ` +
      "If you are behind a corporate proxy, the TUI trusts your operating system's " +
      "certificate store automatically — set DATALATHE_CA_BUNDLE to a PEM file if your " +
      "certificate authority is not found there."
  );
}
