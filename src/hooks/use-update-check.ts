import { useState, useEffect } from "react";
import {
  currentVersion,
  fetchLatestVersion,
  isNewerVersion,
} from "../utils/check-update.js";

interface UpdateInfo {
  latestVersion: string;
}

/**
 * Checks npm for a newer version of @datalathe/tui once on mount.
 * Returns update info if a newer version exists, null otherwise.
 */
export function useUpdateCheck(): UpdateInfo | null {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    fetchLatestVersion().then((latest) => {
      if (latest && isNewerVersion(currentVersion, latest)) {
        setUpdate({ latestVersion: latest });
      }
    });
  }, []);

  return update;
}
