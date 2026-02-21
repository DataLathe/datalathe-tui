import React from "react";
import { Box, Text } from "ink";
import { Select } from "@inkjs/ui";
import { brand } from "../theme.js";
import type { Screen } from "../hooks/use-navigation.js";

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
}

const menuItems = [
  {
    label: "Create Chip",
    value: "create-chip" as Screen,
    description: "Stage data from a source into a new chip",
  },
  {
    label: "Query Chips",
    value: "query" as Screen,
    description: "Run SQL queries against chips",
  },
];

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color={brand.cyan} bold>
        Welcome to DataLathe
      </Text>
      <Text color={brand.muted}>
        Browse databases and chips in the sidebar. Use Tab to switch panels.
      </Text>
      <Box flexDirection="column" paddingTop={1} gap={1}>
        <Text color={brand.violet} bold>
          Actions:
        </Text>
        <Select
          options={menuItems}
          onChange={(value) => onNavigate(value as Screen)}
        />
      </Box>
    </Box>
  );
}
