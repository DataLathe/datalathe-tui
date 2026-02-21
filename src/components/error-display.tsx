import React from "react";
import { Box, Text } from "ink";
import { brand } from "../theme.js";

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
  onBack?: () => void;
}

export function ErrorDisplay({ message, onRetry, onBack }: ErrorDisplayProps) {
  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color={brand.error} bold>
        Error
      </Text>
      <Text color={brand.error}>{message}</Text>
      <Box gap={2}>
        {onRetry && <Text color={brand.muted}>r:retry</Text>}
        {onBack && <Text color={brand.muted}>b:back</Text>}
      </Box>
    </Box>
  );
}
