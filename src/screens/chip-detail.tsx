import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { Spinner } from "@inkjs/ui";
import type { Chip } from "@datalathe/client";
import { useClient } from "../hooks/use-client.js";
import { useAsync } from "../hooks/use-async.js";
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
  onBack: () => void;
  onDeleted: () => void;
  isFocused: boolean;
}

export function ChipDetailScreen({
  chipId,
  checkedChipIds,
  onQuery,
  onBack,
  onDeleted,
  isFocused,
}: ChipDetailScreenProps) {
  const client = useClient();
  const { data, loading, error, refetch } = useAsync(
    () => client.listChips(),
    [chipId],
  );

  const [deleteState, setDeleteState] = useState<DeleteState>({ phase: "idle" });

  useInput((input, key) => {
    if (deleteState.phase === "deleting") return;

    if (deleteState.phase === "confirming") {
      if (input === "y") {
        setDeleteState({ phase: "deleting" });
        client.deleteChip(chipId).then(() => {
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

    if (input === "s") {
      const ids = [...new Set([chipId, ...checkedChipIds])];
      onQuery(ids);
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

  const allChips = data?.chips ?? [];
  const meta = (data?.metadata ?? []).find((m) => m.chip_id === chipId);

  // Main chip: where chip_id === sub_chip_id
  const mainChip = allChips.find(
    (c: Chip) => c.chip_id === chipId && c.chip_id === c.sub_chip_id,
  );

  // Other checked chips for context
  const otherChecked = checkedChipIds.filter((id) => id !== chipId);

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
              {new Date(meta.created_at * 1000).toLocaleString()}
            </Text>
          </Text>
        </Box>
      )}

      {mainChip && (
        <Box flexDirection="column">
          <Text color={brand.cyan} bold>
            Main Chip
          </Text>
          <Text>
            <Text color={brand.muted}>Table: </Text>
            <Text color={brand.violet}>{mainChip.table_name}</Text>
          </Text>
          <Text>
            <Text color={brand.muted}>Partition: </Text>
            <Text color={brand.text}>{mainChip.partition_value || "—"}</Text>
          </Text>
          {mainChip.created_at && (
            <Text>
              <Text color={brand.muted}>Created: </Text>
              <Text color={brand.text}>
                {new Date(mainChip.created_at * 1000).toLocaleString()}
              </Text>
            </Text>
          )}
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
        <Text color={brand.muted}>s:query {otherChecked.length > 0 ? `(${1 + otherChecked.length} chips)` : "this chip"}</Text>
        <Text color={brand.muted}>d:delete</Text>
        <Text color={brand.muted}>b:back</Text>
      </Box>
    </Box>
  );
}
