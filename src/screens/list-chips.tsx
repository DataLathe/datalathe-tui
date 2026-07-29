import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { Spinner } from "@inkjs/ui";
import type { Chip, ChipMetadata, ChipTag } from "@datalathe/client";
import { useClient } from "../hooks/use-client.js";
import { useAsync } from "../hooks/use-async.js";
import { useTerminalSize } from "../hooks/use-terminal-size.js";
import { ErrorDisplay } from "../components/error-display.js";
import { brand } from "../theme.js";
import {
  buildChipIndex,
  formatDate,
  subChipCount,
  partitionSummary,
  tagSummary,
  fit,
} from "../utils/chip-options.js";

interface ListChipsScreenProps {
  onSelectChip: (chipId: string) => void;
  onQuery: (chipIds: string[]) => void;
  onRawQuery: (chipIds: string[]) => void;
  onCreateFromChip: (chipIds: string[]) => void;
  onBack: () => void;
  isFocused: boolean;
}

export function ListChipsScreen({
  onSelectChip,
  onQuery,
  onRawQuery,
  onCreateFromChip,
  onBack,
  isFocused,
}: ListChipsScreenProps) {
  const client = useClient();
  const { rows } = useTerminalSize();
  const { data, loading, error, refetch } = useAsync(
    () => client.chips.list(),
    [],
  );

  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [expandedChipId, setExpandedChipId] = useState<string | null>(null);

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

  // Reserve lines for header, footer, borders
  const maxVisible = Math.max(3, rows - 8);

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.upArrow) {
        setCursor((c) => {
          const next = Math.max(0, c - 1);
          if (next < scrollOffset) setScrollOffset(next);
          return next;
        });
      } else if (key.downArrow) {
        setCursor((c) => {
          const next = Math.min(mainChipIds.length - 1, c + 1);
          if (next >= scrollOffset + maxVisible)
            setScrollOffset(next - maxVisible + 1);
          return next;
        });
      } else if (key.return) {
        const chipId = mainChipIds[cursor];
        if (chipId) {
          setExpandedChipId((prev) => (prev === chipId ? null : chipId));
        }
      } else if (input === "v") {
        const chipId = mainChipIds[cursor];
        if (chipId) onSelectChip(chipId);
      } else if (input === "s") {
        const chipId = mainChipIds[cursor];
        if (chipId) onQuery([chipId]);
      } else if (input === "x") {
        const chipId = mainChipIds[cursor];
        if (chipId) onRawQuery([chipId]);
      } else if (input === "c") {
        const chipId = mainChipIds[cursor];
        if (chipId) onCreateFromChip([chipId]);
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

  const visibleIds = mainChipIds.slice(
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
          {mainChipIds.length} chip
          {mainChipIds.length !== 1 ? "s" : ""}
        </Text>
      </Box>

      {visibleIds.map((chipId, i) => {
        const globalIdx = scrollOffset + i;
        const isCursor = globalIdx === cursor;
        const isExpanded = expandedChipId === chipId;
        const meta = metaMap.get(chipId);
        const subs = subChipCount(chipId, index);
        const chips = index.chipsByChipId.get(chipId) ?? [];
        const tables = [
          ...new Set(chips.map((c: Chip) => c.tableName)),
        ];
        const chipTags = index.tagsByChipId.get(chipId) ?? [];

        return (
          <Box key={chipId} flexDirection="column">
            {/* Summary row */}
            <Box>
              <Text color={isCursor ? brand.cyan : brand.muted}>
                {isCursor ? "\u25B6 " : "  "}
              </Text>
              <Text color={isCursor ? brand.cyan : brand.text} bold={isCursor}>
                {fit(meta?.name ?? chipId.slice(0, 12), 22)}
              </Text>
              <Text color={brand.muted}>  </Text>
              <Text color={brand.violet}>
                {fit(tables.join(", ") || "-", 18)}
              </Text>
              <Text color={brand.muted}>  </Text>
              <Text color={brand.muted}>
                {meta ? formatDate(meta.createdAt) : "-"}
              </Text>
              <Text color={brand.muted}>  </Text>
              <Text color={brand.indigo}>
                {subs > 0 ? `${subs} sub${subs !== 1 ? "s" : ""}` : ""}
              </Text>
              {chipTags.length > 0 && (
                <>
                  <Text color={brand.muted}>  </Text>
                  <Text color={brand.muted} dimColor>
                    {chipTags.map((t: ChipTag) => `${t.key}=${t.value}`).join(" ")}
                  </Text>
                </>
              )}
            </Box>

            {/* Expanded detail */}
            {isExpanded && (
              <Box
                flexDirection="column"
                paddingLeft={4}
                marginBottom={1}
                borderStyle="single"
                borderColor={brand.border}
                paddingX={1}
              >
                <Text>
                  <Text color={brand.muted}>ID:      </Text>
                  <Text color={brand.text}>{chipId}</Text>
                </Text>
                {meta?.name && (
                  <Text>
                    <Text color={brand.muted}>Name:    </Text>
                    <Text color={brand.text}>{meta.name}</Text>
                  </Text>
                )}
                {meta?.description && (
                  <Text>
                    <Text color={brand.muted}>Desc:    </Text>
                    <Text color={brand.text}>{meta.description}</Text>
                  </Text>
                )}
                {meta?.query && (
                  <Text>
                    <Text color={brand.muted}>Query:   </Text>
                    <Text color={brand.violet}>{meta.query}</Text>
                  </Text>
                )}
                <Text>
                  <Text color={brand.muted}>Tables:  </Text>
                  <Text color={brand.violet}>
                    {tables.join(", ") || "-"}
                  </Text>
                </Text>
                {meta?.tables && (
                  <Text>
                    <Text color={brand.muted}>Sources: </Text>
                    <Text color={brand.text}>{meta.tables}</Text>
                  </Text>
                )}
                <Text>
                  <Text color={brand.muted}>Created: </Text>
                  <Text color={brand.text}>
                    {meta
                      ? new Date(meta.createdAt * 1000).toLocaleString()
                      : "-"}
                  </Text>
                </Text>
                {subs > 0 && (
                  <Text>
                    <Text color={brand.muted}>Subs:    </Text>
                    <Text color={brand.text}>
                      {subs} partition{subs !== 1 ? "s" : ""} ({partitionSummary(chipId, index)})
                    </Text>
                  </Text>
                )}
                {chipTags.length > 0 && (
                  <Box flexDirection="column">
                    <Text color={brand.muted}>Tags:</Text>
                    {chipTags.map((t: ChipTag) => (
                      <Text key={t.key}>
                        <Text color={brand.muted}>  {t.key}: </Text>
                        <Text color={brand.text}>{t.value}</Text>
                      </Text>
                    ))}
                  </Box>
                )}
                {meta?.storageBucket && (
                  <Text>
                    <Text color={brand.muted}>Storage: </Text>
                    <Text color={brand.text}>
                      s3://{meta.storageBucket}
                      {meta.storageKeyPrefix
                        ? `/${meta.storageKeyPrefix}`
                        : ""}
                    </Text>
                  </Text>
                )}
                {meta?.ttlDays != null && (
                  <Text>
                    <Text color={brand.muted}>TTL:     </Text>
                    <Text color={brand.text}>{meta.ttlDays} days</Text>
                  </Text>
                )}

                <Box marginTop={1} gap={2}>
                  <Text color={brand.muted}>v:full detail</Text>
                  <Text color={brand.muted}>s:query</Text>
                  <Text color={brand.muted}>x:raw sql</Text>
                  <Text color={brand.muted}>c:create from chip</Text>
                </Box>
              </Box>
            )}
          </Box>
        );
      })}

      {/* Scroll indicator */}
      {mainChipIds.length > maxVisible && (
        <Text color={brand.muted}>
          {" "}
          {scrollOffset > 0 ? "\u2191" : " "} {scrollOffset + 1}-
          {Math.min(scrollOffset + maxVisible, mainChipIds.length)}/
          {mainChipIds.length}{" "}
          {scrollOffset + maxVisible < mainChipIds.length ? "\u2193" : " "}
        </Text>
      )}

      <Box marginTop={1} gap={2}>
        <Text color={brand.muted}>enter:expand</Text>
        <Text color={brand.muted}>v:full detail</Text>
        <Text color={brand.muted}>s:query</Text>
        <Text color={brand.muted}>x:raw sql</Text>
        <Text color={brand.muted}>c:create from chip</Text>
        <Text color={brand.muted}>r:refresh</Text>
        <Text color={brand.muted}>b:back</Text>
      </Box>
    </Box>
  );
}
