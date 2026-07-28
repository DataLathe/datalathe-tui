import React from "react";
import { Box, Text } from "ink";
import { MenuSelect } from "../components/menu-select.js";
import { brand } from "../theme.js";
import type { Screen } from "../hooks/use-navigation.js";

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
  isFocused: boolean;
}

const menuItems = [
  {
    label: "List Chips",
    value: "list-chips" as Screen,
    description: "Browse chips and inspect metadata, queries, and tags",
  },
  {
    label: "Create Chip",
    value: "create-chip" as Screen,
    description: "Stage data from a source into a new chip",
  },
  {
    label: "Create Chip from Chip",
    value: "create-chip-from-chip" as Screen,
    description: "Create a new chip from existing chip(s)",
  },
  {
    label: "Query Chips",
    value: "query" as Screen,
    description: "Run SQL queries against chips",
  },
  {
    label: "Raw SQL",
    value: "raw-query" as Screen,
    description: "Inspect chip contents directly, no view layer",
  },
  {
    label: "Extract Tables",
    value: "extract-tables" as Screen,
    description: "Parse SQL to find referenced tables",
  },
  {
    label: "Delete Chip",
    value: "delete-chip" as Screen,
    description: "Remove a chip and its associated data",
  },
  {
    label: "Connections",
    value: "connections" as Screen,
    description: "Manage database connections",
  },
  {
    label: "Download Binaries",
    value: "download-binaries" as Screen,
    description: "Download engine and chip-manager",
  },
];

export function HomeScreen({ onNavigate, isFocused }: HomeScreenProps) {
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
        <MenuSelect
          options={menuItems}
          onChange={(value) => onNavigate(value as Screen)}
          isDisabled={!isFocused}
        />
      </Box>
    </Box>
  );
}
