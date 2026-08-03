import React, { useState, useMemo, useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Spinner, TextInput } from "@inkjs/ui";
import type { Chip, ChipMetadata } from "@datalathe/client";
import { useClient } from "../hooks/use-client.js";
import { useAsync } from "../hooks/use-async.js";
import { useTerminalSize } from "../hooks/use-terminal-size.js";
import { ErrorDisplay } from "../components/error-display.js";
import { ChipRow } from "../components/chip-row.js";
import { brand } from "../theme.js";
import { buildChipIndex } from "../utils/chip-options.js";
import { filterChipIds } from "../utils/chip-filter.js";

interface ListChipsScreenProps {
  onSelectChip: (chipId: string) => void;
  onQuery: (chipIds: string[]) => void;
  onRawQuery: (chipIds: string[]) => void;
  onCreateFromChip: (chipIds: string[]) => void;
  onServerSearch: () => void;
  onBack: () => void;
  onInputActive?: (active: boolean) => void;
  isFocused: boolean;
}

export function ListChipsScreen({
  onSelectChip,
  onQuery,
  onRawQuery,
  onCreateFromChip,
  onServerSearch,
  onBack,
  onInputActive,
  isFocused,
}: ListChipsScreenProps) {
  const client = useClient();
  const { exit } = useApp();
  const { rows } = useTerminalSize();
  const { data, loading, error, refetch } = useAsync(
    () => client.chips.list(),
    [],
  );

  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [expandedChipId, setExpandedChipId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState(false);
  const [filterText, setFilterText] = useState("");

  const filterActive = filterText.trim().length > 0;

  const { mainChipIds, metaMap, index } = useMemo(() => {
    const allChips = data?.chips ?? [];
    const allTags = data?.tags ?? [];
    const metadata = data?.metadata ?? [];

    const metaMap = new Map<string, ChipMetadata>();
    for (const m of metadata) metaMap.set(m.chipId, m);

    const idx = buildChipIndex(allChips, allTags);

    // Get unique parent chip_ids from all sub_chip rows. Post-v1.4.6
    // there is no parent self-entry row where chip_id === subChipId;
    // chip-manager only stores sub_chip rows, each with a distinct
    // subChipId but sharing the parent chipId.
    const mainChipIds = [
      ...new Set(allChips.map((c: Chip) => c.chipId)),
    ];

    return { mainChipIds, metaMap, index: idx };
  }, [data]);

  const filteredIds = useMemo(
    () => filterChipIds(mainChipIds, filterText, metaMap, index),
    [mainChipIds, filterText, metaMap, index],
  );

  // Reserve lines for header, footer, borders
  const maxVisible = Math.max(3, rows - 8);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, filteredIds.length - 1)));
    setScrollOffset((s) =>
      Math.max(0, Math.min(s, Math.max(0, filteredIds.length - maxVisible))),
    );
  }, [filteredIds.length, maxVisible]);

  // Suppress App's global q/b/esc while filtering so esc clears the filter
  // instead of navigating back; b and q are re-handled locally below.
  useEffect(() => {
    onInputActive?.(filterMode || filterActive);
    return () => onInputActive?.(false);
  }, [filterMode, filterActive, onInputActive]);

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (filterMode) {
        if (key.escape) {
          setFilterText("");
          setFilterMode(false);
        }
        return;
      }

      if (input === "/") {
        setFilterMode(true);
        return;
      }

      if (filterActive && key.escape) {
        setFilterText("");
        return;
      }
      if (filterActive && input === "b") {
        onBack();
        return;
      }
      if (filterActive && input === "q") {
        exit();
        return;
      }

      if (key.upArrow) {
        setCursor((c) => {
          const next = Math.max(0, c - 1);
          if (next < scrollOffset) setScrollOffset(next);
          return next;
        });
      } else if (key.downArrow) {
        setCursor((c) => {
          const next = Math.min(filteredIds.length - 1, c + 1);
          if (next >= scrollOffset + maxVisible)
            setScrollOffset(next - maxVisible + 1);
          return next;
        });
      } else if (key.return) {
        const chipId = filteredIds[cursor];
        if (chipId) {
          setExpandedChipId((prev) => (prev === chipId ? null : chipId));
        }
      } else if (input === "v") {
        const chipId = filteredIds[cursor];
        if (chipId) onSelectChip(chipId);
      } else if (input === "s") {
        const chipId = filteredIds[cursor];
        if (chipId) onQuery([chipId]);
      } else if (input === "x") {
        const chipId = filteredIds[cursor];
        if (chipId) onRawQuery([chipId]);
      } else if (input === "c") {
        const chipId = filteredIds[cursor];
        if (chipId) onCreateFromChip([chipId]);
      } else if (input === "f") {
        onServerSearch();
      } else if (input === "r") {
        refetch();
      }
    },
    { isActive: isFocused },
  );

  if (loading) {
    return <Spinner label="Loading chips..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={refetch} onBack={onBack} />;
  }

  if (mainChipIds.length === 0) {
    return (
      <Box flexDirection="column" gap={1} paddingY={1}>
        <Text color={brand.muted}>No chips found.</Text>
        <Text color={brand.muted} dimColor>
          b:back
        </Text>
      </Box>
    );
  }

  const visibleIds = filteredIds.slice(
    scrollOffset,
    scrollOffset + maxVisible,
  );

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box marginBottom={1}>
        <Text color={brand.cyan} bold>
          Chips{" "}
        </Text>
        <Text color={brand.muted}>
          {filterActive
            ? `${filteredIds.length} of ${mainChipIds.length} chips`
            : `${mainChipIds.length} chip${mainChipIds.length !== 1 ? "s" : ""}`}
        </Text>
      </Box>

      {filterMode && (
        <Box marginBottom={1}>
          <Text color={brand.violet}>{"/ "}</Text>
          <TextInput
            placeholder="filter chips"
            defaultValue={filterText}
            onChange={setFilterText}
            onSubmit={(v) => {
              setFilterText(v);
              setFilterMode(false);
            }}
          />
        </Box>
      )}

      {filteredIds.length === 0 ? (
        <Text color={brand.muted}>No chips match "{filterText.trim()}".</Text>
      ) : (
        visibleIds.map((chipId, i) => (
          <ChipRow
            key={chipId}
            chipId={chipId}
            meta={metaMap.get(chipId)}
            index={index}
            isCursor={scrollOffset + i === cursor}
            isExpanded={expandedChipId === chipId}
          />
        ))
      )}

      {/* Scroll indicator */}
      {filteredIds.length > maxVisible && (
        <Text color={brand.muted}>
          {" "}
          {scrollOffset > 0 ? "↑" : " "} {scrollOffset + 1}-
          {Math.min(scrollOffset + maxVisible, filteredIds.length)}/
          {filteredIds.length}{" "}
          {scrollOffset + maxVisible < filteredIds.length ? "↓" : " "}
        </Text>
      )}

      <Box marginTop={1} gap={2} flexWrap="wrap">
        {filterMode ? (
          <>
            <Text color={brand.muted}>enter:apply</Text>
            <Text color={brand.muted}>esc:clear</Text>
          </>
        ) : (
          <>
            <Text color={brand.muted}>enter:expand</Text>
            <Text color={brand.muted}>v:full detail</Text>
            <Text color={brand.muted}>s:query</Text>
            <Text color={brand.muted}>x:raw sql</Text>
            <Text color={brand.muted}>c:create from chip</Text>
            <Text color={brand.muted}>/:filter</Text>
            <Text color={brand.muted}>f:server search</Text>
            <Text color={brand.muted}>r:refresh</Text>
            <Text color={brand.muted}>b:back</Text>
            {filterActive && (
              <>
                <Text color={brand.cyan}>filter:"{filterText.trim()}"</Text>
                <Text color={brand.muted}>esc:clear</Text>
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
