import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { Select, Spinner } from "@inkjs/ui";
import type { Chip, ChipMetadata } from "@datalathe/client";
import { useClient } from "../hooks/use-client.js";
import { useAsync } from "../hooks/use-async.js";
import { useTerminalSize } from "../hooks/use-terminal-size.js";
import { ErrorDisplay } from "../components/error-display.js";
import { brand } from "../theme.js";
import { chipColumns, chipLabel, chipHeader, hasAnySubChips } from "../utils/chip-options.js";

type DeletePhase = "select" | "confirm" | "deleting" | "done" | "error";

interface ChipOption {
  label: string;
  value: string;
}

interface DeleteChipScreenProps {
  onDone: () => void;
  onBack: () => void;
  isFocused: boolean;
}

export function DeleteChipScreen({
  onDone,
  onBack,
  isFocused,
}: DeleteChipScreenProps) {
  const client = useClient();
  const { data, loading, error, refetch } = useAsync(
    () => client.listChips(),
    [],
  );

  const [phase, setPhase] = useState<DeletePhase>("select");
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useInput((_input, key) => {
    if (phase === "confirm") {
      if (_input === "y") {
        setPhase("deleting");
        client.deleteChip(selectedChipId!).then(() => {
          setPhase("done");
        }).catch((err: unknown) => {
          setPhase("error");
          setDeleteError(err instanceof Error ? err.message : String(err));
        });
      } else if (_input === "n" || key.escape) {
        setPhase("select");
        setSelectedChipId(null);
      }
    }
  }, { isActive: isFocused && (phase === "confirm") });

  const { columns: termCols } = useTerminalSize();

  if (loading) {
    return <Spinner label="Loading chips..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={refetch} onBack={onBack} />;
  }

  const allChips = data?.chips ?? [];
  const metadata = data?.metadata ?? [];
  const metaMap = new Map<string, ChipMetadata>();
  for (const m of metadata) {
    metaMap.set(m.chip_id, m);
  }

  const mainChips = allChips.filter(
    (c: Chip) => c.chip_id === c.sub_chip_id,
  );
  const uniqueIds = [...new Set(mainChips.map((c: Chip) => c.chip_id))];

  const sidebarWidth = Math.min(50, Math.floor(termCols * 0.38));
  const panelWidth = termCols - sidebarWidth - 4;
  // Select uses 2-char indicator ("› ")
  const showSubs = hasAnySubChips(allChips);
  const cols = chipColumns(panelWidth, 2, showSubs);

  const options: ChipOption[] = uniqueIds.map((id) => ({
    label: chipLabel(id, metaMap.get(id), allChips, cols),
    value: id,
  }));

  if (options.length === 0) {
    return (
      <Box flexDirection="column" gap={1} paddingY={1}>
        <Text color={brand.cyan} bold>Delete Chip</Text>
        <Text color={brand.muted}>No chips to delete.</Text>
        <Text color={brand.muted}>b:back</Text>
      </Box>
    );
  }

  const selectedMeta = selectedChipId ? metaMap.get(selectedChipId) : null;
  const selectedSubChipCount = selectedChipId
    ? allChips.filter((c: Chip) => c.chip_id === selectedChipId && c.chip_id !== c.sub_chip_id).length
    : 0;

  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color={brand.cyan} bold>Delete Chip</Text>

      {phase === "select" && (
        <Box flexDirection="column">
          <Text color={brand.muted}>Select a chip to delete:</Text>
          <Text color={brand.violet} bold>{chipHeader(cols, 2)}</Text>
          <Text color={brand.border}>{"  " + "─".repeat(Math.min(panelWidth - 4, panelWidth))}</Text>
          {isFocused ? (
            <Select
              options={options}
              onChange={(value) => {
                setSelectedChipId(value);
                setPhase("confirm");
              }}
            />
          ) : (
            <Box flexDirection="column">
              {options.map((opt) => (
                <Text key={opt.value} color={brand.text}>{"  "}{opt.label}</Text>
              ))}
            </Box>
          )}
        </Box>
      )}

      {phase === "confirm" && selectedMeta && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.error} bold>
            Delete "{selectedMeta.name}"?
          </Text>
          <Text color={brand.muted}>ID: {selectedChipId}</Text>
          {selectedSubChipCount > 0 && (
            <Text color={brand.muted}>
              Sub-chips: {selectedSubChipCount}
            </Text>
          )}
          <Text color={brand.muted}>
            This will remove the chip metadata, local files, and S3 objects.
          </Text>
          <Text color={brand.error} bold>
            y:confirm  n:cancel
          </Text>
        </Box>
      )}

      {phase === "confirm" && !selectedMeta && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.error} bold>
            Delete chip {selectedChipId?.slice(0, 8)}…?
          </Text>
          <Text color={brand.muted}>
            This will remove the chip metadata, local files, and S3 objects.
          </Text>
          <Text color={brand.error} bold>
            y:confirm  n:cancel
          </Text>
        </Box>
      )}

      {phase === "deleting" && <Spinner label="Deleting chip..." />}

      {phase === "done" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.success} bold>Chip deleted successfully.</Text>
          <Text color={brand.muted}>Press b to go back.</Text>
        </Box>
      )}

      {phase === "error" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.error}>Delete failed: {deleteError}</Text>
          <Text color={brand.muted}>Press b to go back.</Text>
        </Box>
      )}
    </Box>
  );
}
