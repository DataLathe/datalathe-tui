import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { Spinner } from "@inkjs/ui";
import type { DatalatheClient, ChipMetadata, Chip } from "@datalathe/client";
import { brand } from "../theme.js";
import { formatDate, buildChipIndex, subChipCount, partitionSummary, tagSummary } from "../utils/chip-options.js";

interface ChipEntry {
  chipId: string;
  name: string;
  table: string;
  created: string;
  subChipCount: number;
  partitionLabel: string | null;
  tagLabel: string | null;
}

interface ChipsListProps {
  client: DatalatheClient;
  isFocused: boolean;
  checkedChipIds: string[];
  onCheckedChange: (chipIds: string[]) => void;
  onSelectChip: (chipId: string) => void;
  height: number;
  refreshKey?: number;
}

export function ChipsList({
  client,
  isFocused,
  checkedChipIds,
  onCheckedChange,
  onSelectChip,
  height,
  refreshKey,
}: ChipsListProps) {
  const [chips, setChips] = useState<ChipEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  const loadChips = () => {
    setLoading(true);
    client.listChips().then((data) => {
      const metaMap = new Map<string, ChipMetadata>();
      for (const m of data.metadata) {
        metaMap.set(m.chip_id, m);
      }

      const allTags = data.tags ?? [];
      const index = buildChipIndex(data.chips, allTags);

      // Only show main chips (chip_id === sub_chip_id)
      const mainChips = data.chips.filter(
        (c: Chip) => c.chip_id === c.sub_chip_id,
      );
      const uniqueIds = [...new Set(mainChips.map((c: Chip) => c.chip_id))];
      setChips(uniqueIds.map((id) => {
        const meta = metaMap.get(id);
        const chips = index.chipsByChipId.get(id) ?? [];
        const tables = [...new Set(chips.map((c: Chip) => c.table_name))];
        const ps = partitionSummary(id, index);
        const ts = tagSummary(id, index);
        return {
          chipId: id,
          name: meta?.name ?? id.slice(0, 12),
          table: tables.join(", ") || "\u2014",
          created: meta ? formatDate(meta.created_at) : "\u2014",
          subChipCount: subChipCount(id, index),
          partitionLabel: ps !== "\u2014" ? ps : null,
          tagLabel: ts !== "\u2014" ? ts : null,
        };
      }));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    loadChips();
  }, [client, refreshKey]);

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

  // Keep scroll offset in sync with cursor
  // Each chip takes 3 rows (name + details + tags/partitions) or 2 if no tags/partitions
  const hasAnyExtra = chips.some((c) => c.partitionLabel || c.tagLabel);
  const rowsPerChip = hasAnyExtra ? 3 : 2;
  const maxVisible = Math.max(1, Math.floor(height / rowsPerChip));

  useEffect(() => {
    setScrollOffset((prev) => {
      if (cursor >= prev + maxVisible) return cursor - maxVisible + 1;
      if (cursor < prev) return cursor;
      return prev;
    });
  }, [cursor, maxVisible]);

  if (loading) {
    return <Spinner label="Loading..." />;
  }

  if (chips.length === 0) {
    return <Text color={brand.muted}>No chips</Text>;
  }

  const visible = chips.slice(scrollOffset, scrollOffset + maxVisible);
  const canScrollUp = scrollOffset > 0;
  const canScrollDown = scrollOffset + maxVisible < chips.length;
  const hasAnySubs = chips.some((c) => c.subChipCount > 0);

  return (
    <Box flexDirection="column">
      {visible.map((chip, i) => {
        const globalIdx = scrollOffset + i;
        const isCursor = isFocused && globalIdx === cursor;
        const isChecked = checkedChipIds.includes(chip.chipId);
        const checkbox = isChecked ? "\u2611" : "\u2610";

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
              <Text color={brand.muted}>{" \u00b7 "}{chip.created}</Text>
              {hasAnySubs && (
                <Text color={brand.muted}>{" \u00b7 "}{chip.subChipCount} sub{chip.subChipCount !== 1 ? "s" : ""}</Text>
              )}
            </Text>
            {(chip.partitionLabel || chip.tagLabel) && (
              <Text>
                <Text color={brand.muted}>{"     "}</Text>
                {chip.partitionLabel && (
                  <Text color={brand.indigo}>{chip.partitionLabel}</Text>
                )}
                {chip.partitionLabel && chip.tagLabel && (
                  <Text color={brand.muted}>{" \u00b7 "}</Text>
                )}
                {chip.tagLabel && (
                  <Text color={brand.muted}>{chip.tagLabel}</Text>
                )}
              </Text>
            )}
          </Box>
        );
      })}
      {(canScrollUp || canScrollDown) && (
        <Text color={brand.muted}>
          {" "}{canScrollUp ? "\u2191" : " "} {scrollOffset + 1}\u2013{Math.min(scrollOffset + maxVisible, chips.length)}/{chips.length} {canScrollDown ? "\u2193" : " "}
        </Text>
      )}
    </Box>
  );
}
