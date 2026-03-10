const LICENSE_API = "https://license.datalathe.com";

export interface VersionsResponse {
  versions: string[];
  platforms: string[];
}

export interface DownloadUrlsResponse {
  urls: {
    engine: string;
    chipManager: string;
  };
  expiresIn: number;
}

async function licenseFetch(
  path: string,
  body: Record<string, string>
): Promise<Response> {
  try {
    return await fetch(`${LICENSE_API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const cause = err instanceof Error ? err.cause : undefined;
    const detail =
      cause instanceof Error ? cause.message : String(err);
    throw new Error(
      `Could not reach license server (${detail}). Check your network connection.`
    );
  }
}

export async function fetchVersions(
  licenseKey: string
): Promise<VersionsResponse> {
  const res = await licenseFetch("/downloads/versions", { licenseKey });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, string>;
    throw new Error(
      body.reason || body.error || `License validation failed (${res.status})`
    );
  }

  return (await res.json()) as VersionsResponse;
}

export async function fetchDownloadUrls(
  licenseKey: string,
  version: string,
  platform: string
): Promise<DownloadUrlsResponse> {
  const res = await licenseFetch("/downloads/urls", {
    licenseKey,
    version,
    platform,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, string>;
    throw new Error(
      body.error || `Failed to get download URLs (${res.status})`
    );
  }

  return (await res.json()) as DownloadUrlsResponse;
}
