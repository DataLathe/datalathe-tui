import { readFile } from "node:fs/promises";
import { fetchVersions } from "./license-api.js";
import { isNewerVersion } from "./check-update.js";
import { manifestPath, licensePath } from "./datalathe-paths.js";

interface Manifest {
  version: string;
  platform: string;
  downloadedAt: string;
}

export interface BinaryUpdateInfo {
  installedVersion: string;
  latestVersion: string;
}

/**
 * Check if a newer version of the datalathe binaries is available.
 * Reads the install manifest and license key from their default locations,
 * then queries the license API for available versions.
 * Returns null if binaries aren't installed, no license key, or check fails.
 */
export async function checkBinaryUpdate(): Promise<BinaryUpdateInfo | null> {
  try {
    const [manifestRaw, licenseRaw] = await Promise.all([
      readFile(manifestPath, "utf-8"),
      readFile(licensePath, "utf-8"),
    ]);

    const manifest = JSON.parse(manifestRaw) as Manifest;
    const { licenseKey } = JSON.parse(licenseRaw) as { licenseKey: string };

    if (!manifest.version || !licenseKey) return null;

    const { versions } = await fetchVersions(licenseKey);
    if (!versions.length) return null;

    // Versions are returned from the API; pick the highest one
    const latest = versions.reduce((a, b) => (isNewerVersion(a, b) ? b : a));

    if (isNewerVersion(manifest.version, latest)) {
      return { installedVersion: manifest.version, latestVersion: latest };
    }

    return null;
  } catch {
    return null;
  }
}
