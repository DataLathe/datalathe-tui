import { useState, useEffect } from "react";
import {
  checkBinaryUpdate,
  type BinaryUpdateInfo,
} from "../utils/check-binary-update.js";

/**
 * Checks for a newer version of the datalathe binaries once on mount.
 * Only works when binaries were installed to the default location
 * (~/.datalathe/bin) and a license key exists at ~/.datalathe/config/license.json.
 */
export function useBinaryUpdateCheck(): BinaryUpdateInfo | null {
  const [update, setUpdate] = useState<BinaryUpdateInfo | null>(null);

  useEffect(() => {
    checkBinaryUpdate().then((info) => {
      if (info) setUpdate(info);
    });
  }, []);

  return update;
}
