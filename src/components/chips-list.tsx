import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { Spinner } from "@inkjs/ui";
import type { DatalatheClient, ChipMetadata, Chip } from "@datalathe/client";
import { brand } from "../theme.js";

interface ChipEntry {
  chipId: string;
  name: string;
  table: string;
  created: string;
}

interface ChipsListProps {
  client: DatalatheClient;
  isFocused: boolean;
  checkedChipIds: string[];
  onCheckedChange: (chipIds: string[]) => void;
  onSelectChip: (chipId: string) => void;
  height: number;
}

function formatDate(epoch: number): string {
  return new Date(epoch * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ChipsList({
  client,
  isFocused,
  checkedChipIds,
  onCheckedChange,
  onSelectChip,
  height,
}: ChipsListProps) {
  const [chips, setChips] = useState<ChipEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(0);

  const loadChips = () => {
    setLoading(true);
    client.listChips().then((data) => {
      const metaMap = new Map<string, ChipMetadata>();
      for (const m of data.metadata) {
        metaMap.set(m.chip_id, m);
      }
      // Only show main chips (chip_id === sub_chip_id)
      const mainChips = data.chips.filter(
        (c: Chip) => c.chip_id === c.sub_chip_id,
      );
      const uniqueIds = [...new Set(mainChips.map((c: Chip) => c.chip_id))];
      setChips(uniqueIds.map((id) => {
        const meta = metaMap.get(id);
        const tables = [...new Set(
          mainChips.filter((c: Chip) => c.chip_id === id).map((c: Chip) => c.table_name),
        )];
        return {
          chipId: id,
          name: meta?.name ?? id.slice(0, 12),
          table: tables.join(", ") || "—",
          created: meta ? formatDate(meta.created_at) : "—",
        };
      }));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    loadChips();
  }, [client]);

  useInput((input, key) => {
    if (!isFocused || chips.length === 0) return;

    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
    } else if (key.downArrow) {
      setCursor((c) => Math.min(chips.length - 1, c + 1));
    } else if (key.return) {
      onSelectChip(chips[cursor]!.chipId);
    } else if (input === " ") {
      const chipId = chips[cursor]!.chipId;
      const checked = new Set(checkedChipIds);
      if (checked.has(chipId)) {
        checked.delete(chipId);
      } else {
        checked.add(chipId);
      }
      onCheckedChange([...checked]);
    } else if (input === "r") {
      loadChips();
    }
  });

  useEffect(() => {
    if (cursor >= chips.length && chips.length > 0) {
      setCursor(chips.length - 1);
    }
  }, [cursor, chips.length]);

  if (loading) {
    return <Spinner label="Loading..." />;
  }

  if (chips.length === 0) {
    return <Text color={brand.muted}>No chips</Text>;
  }

  // Each chip takes 2 rows (name + details), so halve visible count
  const maxVisible = Math.max(1, Math.floor((height - 1) / 2));
  let scrollOffset = 0;
  if (cursor >= scrollOffset + maxVisible) {
    scrollOffset = cursor - maxVisible + 1;
  }
  if (cursor < scrollOffset) {
    scrollOffset = cursor;
  }
  const visible = chips.slice(scrollOffset, scrollOffset + maxVisible);

  return (
    <Box flexDirection="column">
      {visible.map((chip, i) => {
        const globalIdx = scrollOffset + i;
        const isCursor = isFocused && globalIdx === cursor;
        const isChecked = checkedChipIds.includes(chip.chipId);
        const checkbox = isChecked ? "☑" : "☐";

        return (
          <Box key={chip.chipId} flexDirection="column">
            <Text>
              <Text color={isCursor ? brand.cyan : brand.muted}>
                {isCursor ? ">" : " "}{" "}
              </Text>
              <Text color={isChecked ? brand.success : brand.muted}>{checkbox} </Text>
              <Text color={isCursor ? brand.cyan : brand.text}>{chip.name}</Text>
            </Text>
            <Text>
              <Text color={brand.muted}>{"     "}</Text>
              <Text color={brand.violet}>{chip.table}</Text>
              <Text color={brand.muted}>{" · "}{chip.created}</Text>
            </Text>
          </Box>
        );
      })}
      {chips.length > maxVisible && (
        <Text color={brand.muted} dimColor>
          {" "} {scrollOffset > 0 ? "↑" : " "} {scrollOffset + maxVisible < chips.length ? "↓" : " "}
        </Text>
      )}
    </Box>
  );
}
