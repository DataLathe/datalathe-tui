import React from "react";
import { Box, Text } from "ink";
import { Select } from "@inkjs/ui";
import { brand } from "../theme.js";
import type { Screen } from "../hooks/use-navigation.js";

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
  isFocused: boolean;
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
  {
    label: "Delete Chip",
    value: "delete-chip" as Screen,
    description: "Remove a chip and its associated data",
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
        {isFocused ? (
          <Select
            options={menuItems}
            onChange={(value) => onNavigate(value as Screen)}
          />
        ) : (
          <Box flexDirection="column">
            {menuItems.map((item) => (
              <Text key={item.value} color={brand.text}>
                {"  "}{item.label}{" "}
                <Text color={brand.muted}>{item.description}</Text>
              </Text>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
