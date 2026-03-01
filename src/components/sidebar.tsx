import React from "react";
import { Box, Text } from "ink";
import type { DatalatheClient } from "@datalathe/client";
import type { Panel } from "../hooks/use-panel-focus.js";
import { DatabasesTree } from "./databases-tree.js";
import { ChipsList } from "./chips-list.js";
import { brand } from "../theme.js";

interface SidebarProps {
  client: DatalatheClient;
  activePanel: Panel;
  width: number;
  height: number;
  checkedChipIds: string[];
  onCheckedChipIdsChange: (chipIds: string[]) => void;
  onSelectTable: (databaseName: string, tableName: string) => void;
  onSelectChip: (chipId: string) => void;
  refreshKey?: number;
}

export function Sidebar({
  client,
  activePanel,
  width,
  height,
  checkedChipIds,
  onCheckedChipIdsChange,
  onSelectTable,
  onSelectChip,
  refreshKey,
}: SidebarProps) {
  const dbFocused = activePanel === "databases";
  const chipsFocused = activePanel === "chips";

  // Split height: databases gets 60%, chips gets 40%
  const dbHeight = Math.floor((height - 4) * 0.6); // -4 for two title bars
  const chipsHeight = height - 4 - dbHeight;

  const dbBorder = dbFocused ? brand.cyan : brand.border;
  const chipsBorder = chipsFocused ? brand.cyan : brand.border;

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Databases panel */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={dbBorder}
        height={dbHeight + 2}
        overflow="hidden"
      >
        <Box paddingX={1}>
          <Text color={dbFocused ? brand.cyan : brand.violet} bold>
            Databases
          </Text>
          {dbFocused && (
            <Text color={brand.muted} dimColor>
              {" "}↑↓:nav ←→:fold ⏎:open
            </Text>
          )}
        </Box>
        <Box paddingX={1} flexDirection="column" flexGrow={1}>
          <DatabasesTree
            client={client}
            isFocused={dbFocused}
            onSelectTable={onSelectTable}
            height={dbHeight}
          />
        </Box>
      </Box>

      {/* Chips panel */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={chipsBorder}
        flexGrow={1}
        overflow="hidden"
      >
        <Box paddingX={1}>
          <Text color={chipsFocused ? brand.cyan : brand.violet} bold>
            Chips
          </Text>
          {chipsFocused && (
            <Text color={brand.muted} dimColor>
              {" "}␣:check ⏎:open r:refresh
            </Text>
          )}
        </Box>
        <Box paddingX={1} flexDirection="column" flexGrow={1}>
          <ChipsList
            client={client}
            isFocused={chipsFocused}
            checkedChipIds={checkedChipIds}
            onCheckedChange={onCheckedChipIdsChange}
            onSelectChip={onSelectChip}
            height={chipsHeight}
            refreshKey={refreshKey}
          />
        </Box>
      </Box>
    </Box>
  );
}
