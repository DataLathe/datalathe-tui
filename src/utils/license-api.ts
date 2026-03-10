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

export async function fetchVersions(
  licenseKey: string
): Promise<VersionsResponse> {
  const res = await fetch(`${LICENSE_API}/downloads/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ licenseKey }),
  });

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
  const res = await fetch(`${LICENSE_API}/downloads/urls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ licenseKey, version, platform }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, string>;
    throw new Error(
      body.error || `Failed to get download URLs (${res.status})`
    );
  }

  return (await res.json()) as DownloadUrlsResponse;
}
