import React, { useState } from "react";
import { Box, Text } from "ink";
import { TextInput, Spinner } from "@inkjs/ui";
import { DatalatheClient } from "@datalathe/client";
import { AsciiLogo } from "../components/ascii-logo.js";
import { brand } from "../theme.js";

interface ConnectScreenProps {
  initialUrl: string;
  onConnect: (client: DatalatheClient, url: string) => void;
}

export function ConnectScreen({ initialUrl, onConnect }: ConnectScreenProps) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState(initialUrl);

  const handleSubmit = async (value: string) => {
    const url = value.trim() || initialUrl;
    setTargetUrl(url);
    setConnecting(true);
    setError(null);

    try {
      const client = new DatalatheClient(url);
      await client.getDatabases();
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
          Press Enter to connect
        </Text>
      </Box>
    </Box>
  );
}
