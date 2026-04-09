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
  const update = useUpdateCheck();
  const binaryUpdate = useBinaryUpdateCheck();

  useInput((input) => {
    if (!connecting && input === "d" && onDownload) {
      onDownload();
    }
  });

  const handleSubmit = async (value: string) => {
    const url = value.trim() || initialUrl;
    setTargetUrl(url);
    setConnecting(true);
    setError(null);

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
    }
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
        <Text color={brand.muted} dimColor>
          Press Enter to connect · d to download binaries
        </Text>
      </Box>
    </Box>
  );
}
