import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput, Spinner } from "@inkjs/ui";
import { DatalatheClient } from "@datalathe/client";
import { AsciiLogo } from "../components/ascii-logo.js";
import { saveLastUrl } from "../cli.js";
import { brand } from "../theme.js";
import { currentVersion } from "../utils/check-update.js";
import { useUpdateCheck } from "../hooks/use-update-check.js";
import { useBinaryUpdateCheck } from "../hooks/use-binary-update-check.js";
import {
  isLocalUrl,
  binariesInstalled,
  startServices,
} from "../utils/local-services.js";

/** Request timeout in ms. Create-chip can take minutes. */
const CLIENT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

interface ConnectScreenProps {
  initialUrl: string;
  onConnect: (client: DatalatheClient, url: string) => void;
  onDownload?: () => void;
}

export function ConnectScreen({ initialUrl, onConnect, onDownload }: ConnectScreenProps) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState(initialUrl);
  const [offerLocalStart, setOfferLocalStart] = useState(false);
  const [startingLocal, setStartingLocal] = useState(false);
  const [startProgress, setStartProgress] = useState<string | null>(null);
  const update = useUpdateCheck();
  const binaryUpdate = useBinaryUpdateCheck();

  useInput((input) => {
    if (connecting || startingLocal) return;
    if (input === "d" && onDownload) {
      onDownload();
    }
    if (input === "s" && offerLocalStart) {
      handleStartLocal();
    }
  });

  const handleSubmit = async (value: string) => {
    const url = value.trim() || initialUrl;
    setTargetUrl(url);
    setConnecting(true);
    setError(null);
    setOfferLocalStart(false);

    try {
      const devKey = process.env.DATALATHE_DEV_KEY;
      const client = new DatalatheClient(url, {
        timeout: CLIENT_TIMEOUT_MS,
        ...(devKey ? { headers: { "x-datalathe-dev-key": devKey } } : {}),
      });
      await client.getDatabases();
      saveLastUrl(url);
      onConnect(client, url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Connection failed",
      );
      setConnecting(false);
      if (isLocalUrl(url) && (await binariesInstalled())) {
        setOfferLocalStart(true);
      }
    }
  };

  const handleStartLocal = async () => {
    setStartingLocal(true);
    setError(null);
    const results = await startServices(setStartProgress);
    setStartProgress(null);
    setStartingLocal(false);
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      setError(
        failed
          .map((r) =>
            [`${r.name}: ${r.message}`, ...r.logTail.slice(-3).map((l) => `  ${l}`)].join("\n"),
          )
          .join("\n"),
      );
      return;
    }
    setOfferLocalStart(false);
    handleSubmit(targetUrl);
  };

  return (
    <Box flexDirection="column" alignItems="center" gap={1}>
      <AsciiLogo />
      <Text color={brand.muted} dimColor>v{currentVersion}</Text>
      {update && (
        <Text color={brand.cyan}>
          TUI update: v{update.latestVersion} available — run <Text bold>npm i -g @datalathe/tui</Text>
        </Text>
      )}
      {binaryUpdate && (
        <Text color={brand.cyan}>
          Engine update: v{binaryUpdate.latestVersion} available (installed: v{binaryUpdate.installedVersion}) — press <Text bold>d</Text> to update
        </Text>
      )}
      <Box flexDirection="column" gap={1} paddingTop={1} alignItems="center">
        <Text color={brand.text}>
          Enter DataLathe URL:
        </Text>
        {connecting ? (
          <Spinner label={`Connecting to ${targetUrl}...`} />
        ) : startingLocal ? (
          <Spinner label={startProgress ?? "Starting local services..."} />
        ) : (
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder={initialUrl}
              defaultValue={initialUrl}
              onSubmit={handleSubmit}
            />
          </Box>
        )}
        {error && (
          <Text color={brand.error}>{error}</Text>
        )}
        {offerLocalStart && !startingLocal && (
          <Text color={brand.cyan}>
            Local binaries installed — press <Text bold>s</Text> to start engine + chip-manager and retry
          </Text>
        )}
        <Text color={brand.muted} dimColor>
          Press Enter to connect · d to download binaries
        </Text>
      </Box>
    </Box>
  );
}
