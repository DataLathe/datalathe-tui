import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { Spinner } from "@inkjs/ui";
import type { Chip, ChipTag } from "@datalathe/client";
import { useClient } from "../hooks/use-client.js";
import { useAsync } from "../hooks/use-async.js";
import { useTerminalSize } from "../hooks/use-terminal-size.js";
import { scrollWindow } from "../utils/chip-options.js";
import { ErrorDisplay } from "../components/error-display.js";
import { brand } from "../theme.js";

type DeleteState =
  | { phase: "idle" }
  | { phase: "confirming" }
  | { phase: "deleting" }
  | { phase: "error"; message: string };

interface ChipDetailScreenProps {
  chipId: string;
  checkedChipIds: string[];
  onQuery: (chipIds: string[]) => void;
  onCreateFromChip: (chipIds: string[]) => void;
  onBack: () => void;
  onDeleted: () => void;
  isFocused: boolean;
}

export function ChipDetailScreen({
  chipId,
  checkedChipIds,
  onQuery,
  onCreateFromChip,
  onBack,
  onDeleted,
  isFocused,
}: ChipDetailScreenProps) {
  const client = useClient();
  const { data, loading, error, refetch } = useAsync(
    () => client.chips.get(chipId),
    [chipId],
  );

  const [deleteState, setDeleteState] = useState<DeleteState>({ phase: "idle" });
  const [scrollOffset, setScrollOffset] = useState(0);
  const { rows } = useTerminalSize();

  const meta = (data?.metadata ?? []).find((m) => m.chipId === chipId);
  const chipTags = (data?.tags ?? []).filter((t: ChipTag) => t.chipId === chipId);
  const subChips = (data?.chips ?? []).filter((c: Chip) => c.chipId === chipId);
  const otherChecked = checkedChipIds.filter((id) => id !== chipId);

  const reserved =
    14 +
    (meta?.query ? 1 : 0) +
    (meta?.partitionColumn ? 1 : 0) +
    (chipTags.length > 0 ? chipTags.length + 1 : 0);
  const maxVisible = Math.max(3, rows - reserved);

  useInput((input, key) => {
    if (deleteState.phase === "deleting") return;

    if (deleteState.phase === "confirming") {
      if (input === "y") {
        setDeleteState({ phase: "deleting" });
        client.chips.delete(chipId).then(() => {
          onDeleted();
        }).catch((err: unknown) => {
          setDeleteState({
            phase: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        });
      } else if (input === "n" || key.escape) {
        setDeleteState({ phase: "idle" });
      }
      return;
    }

    if (key.upArrow) {
      setScrollOffset((o) => Math.max(0, o - 1));
    } else if (key.downArrow) {
      setScrollOffset((o) =>
        Math.min(Math.max(0, subChips.length - maxVisible), o + 1),
      );
    } else if (input === "s") {
      const ids = [...new Set([chipId, ...checkedChipIds])];
      onQuery(ids);
    } else if (input === "c") {
      const ids = [...new Set([chipId, ...checkedChipIds])];
      onCreateFromChip(ids);
    } else if (input === "d") {
      setDeleteState({ phase: "confirming" });
    }
  }, { isActive: isFocused });

  if (loading) {
    return <Spinner label="Loading chip details..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={refetch} onBack={onBack} />;
  }

  const { start, end, indicator } = scrollWindow(
    subChips.length,
    maxVisible,
    scrollOffset,
  );
  const tables = [...new Set(subChips.map((c: Chip) => c.tableName))];
  const subChipLabel = (c: Chip) =>
    meta?.partitionColumn
      ? `${meta.partitionColumn} = ${c.partitionValue || "—"}`
      : c.partitionValue || "";
  const labelWidth = subChips.reduce(
    (w, c) => Math.max(w, subChipLabel(c).length),
    0,
  );

  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color={brand.cyan} bold>
        Chip: {chipId.slice(0, 8)}…
      </Text>

      {meta && (
        <Box flexDirection="column">
          <Text>
            <Text color={brand.muted}>Name: </Text>
            <Text color={brand.text}>{meta.name}</Text>
          </Text>
          <Text>
            <Text color={brand.muted}>Description: </Text>
            <Text color={brand.text}>{meta.description}</Text>
          </Text>
          {meta.query && (
            <Text>
              <Text color={brand.muted}>Query: </Text>
              <Text color={brand.violet}>{meta.query}</Text>
            </Text>
          )}
          <Text>
            <Text color={brand.muted}>Created: </Text>
            <Text color={brand.text}>
              {new Date(meta.createdAt * 1000).toLocaleString()}
            </Text>
          </Text>
        </Box>
      )}

      {subChips.length > 0 && (
        <Box flexDirection="column">
          <Box>
            <Text color={brand.cyan} bold>
              Sub-chips ({subChips.length})
            </Text>
            {indicator && (
              <Text color={brand.muted}>   {indicator}</Text>
            )}
          </Box>
          <Text>
            <Text color={brand.muted}>Table: </Text>
            <Text color={brand.violet}>{tables.join(", ") || "—"}</Text>
          </Text>
          {meta?.partitionColumn && (
            <Text>
              <Text color={brand.muted}>Partitioned by: </Text>
              <Text color={brand.text}>{meta.partitionColumn}</Text>
            </Text>
          )}
          <Box flexDirection="column" marginTop={1}>
            {subChips.slice(start, end).map((c: Chip) => (
              <Text key={c.subChipId}>
                <Text color={brand.text}>
                  {"  " + subChipLabel(c).padEnd(labelWidth)}
                </Text>
                <Text color={brand.muted}>  sub: </Text>
                <Text color={brand.muted} dimColor>
                  {c.subChipId.slice(0, 8)}
                </Text>
              </Text>
            ))}
          </Box>
        </Box>
      )}

      {chipTags.length > 0 && (
        <Box flexDirection="column">
          <Text color={brand.cyan} bold>
            Tags
          </Text>
          {chipTags.map((t: ChipTag) => (
            <Text key={t.key}>
              <Text color={brand.muted}>{t.key}: </Text>
              <Text color={brand.text}>{t.value}</Text>
            </Text>
          ))}
        </Box>
      )}

      {otherChecked.length > 0 && (
        <Box flexDirection="column">
          <Text color={brand.muted} dimColor>
            Also querying with {otherChecked.length} checked chip{otherChecked.length > 1 ? "s" : ""} from sidebar
          </Text>
        </Box>
      )}

      {deleteState.phase === "deleting" && <Spinner label="Deleting chip..." />}

      {deleteState.phase === "error" && (
        <Text color={brand.error}>Delete failed: {deleteState.message}</Text>
      )}

      {deleteState.phase === "confirming" && (
        <Text color={brand.error} bold>
          Delete this chip? y:confirm  n:cancel
        </Text>
      )}

      <Box gap={2}>
        {indicator && <Text color={brand.muted}>↑↓:scroll</Text>}
        <Text color={brand.muted}>s:query {otherChecked.length > 0 ? `(${1 + otherChecked.length} chips)` : "this chip"}</Text>
        <Text color={brand.muted}>c:create from chip</Text>
        <Text color={brand.muted}>d:delete</Text>
        <Text color={brand.muted}>b:back</Text>
      </Box>
    </Box>
  );
}
