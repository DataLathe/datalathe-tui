import https from "node:https";

const LICENSE_API_HOST = "license.datalathe.com";
const agent = new https.Agent({ rejectUnauthorized: false });

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

function httpsPost(path: string, body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: LICENSE_API_HOST,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        agent,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString();
          try {
            resolve({
              status: res.statusCode ?? 500,
              data: JSON.parse(raw) as Record<string, unknown>,
            });
          } catch {
            reject(new Error(`Invalid JSON response: ${raw.slice(0, 200)}`));
          }
        });
      }
    );

    req.on("error", (err) => {
      reject(
        new Error(
          `Could not reach license server (${err.message}). Check your network connection.`
        )
      );
    });

    req.write(payload);
    req.end();
  });
}

export async function fetchVersions(
  licenseKey: string
): Promise<VersionsResponse> {
  const { status, data } = await httpsPost("/downloads/versions", {
    licenseKey,
  });

  if (status >= 400) {
    throw new Error(
      (data.reason as string) ||
        (data.error as string) ||
        `License validation failed (${status})`
    );
  }

  return data as unknown as VersionsResponse;
}

export async function fetchDownloadUrls(
  licenseKey: string,
  version: string,
  platform: string
): Promise<DownloadUrlsResponse> {
  const { status, data } = await httpsPost("/downloads/urls", {
    licenseKey,
    version,
    platform,
  });

  if (status >= 400) {
    throw new Error(
      (data.error as string) ||
        `Failed to get download URLs (${status})`
    );
  }

  return data as unknown as DownloadUrlsResponse;
}
