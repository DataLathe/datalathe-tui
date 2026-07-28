import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput, Spinner, MultiSelect } from "@inkjs/ui";
import type { ChipQueryResult } from "@datalathe/client";
import { useClient } from "../hooks/use-client.js";
import { useAsync } from "../hooks/use-async.js";
import { useTerminalSize } from "../hooks/use-terminal-size.js";
import { TableView } from "../components/table-view.js";
import { ErrorDisplay } from "../components/error-display.js";
import { brand } from "../theme.js";
import { formatDate, chipLabel, chipHeader, chipDisplayConfig } from "../utils/chip-options.js";

type Step = "select-chips" | "sql" | "executing" | "results";

interface RawQueryScreenProps {
  defaultChipIds?: string[];
  onBack: () => void;
  onInputActive?: (active: boolean) => void;
  isFocused: boolean;
}

function toRecords(result: ChipQueryResult): Record<string, unknown>[] {
  return result.rows.map((row) =>
    Object.fromEntries(result.columns.map((col, i) => [col.name, row[i]])),
  );
}

export function RawQueryScreen({ defaultChipIds, onBack, onInputActive, isFocused }: RawQueryScreenProps) {
  const { columns: termCols, rows: termRows } = useTerminalSize();
  const client = useClient();
  const { data: chipsData, loading: chipsLoading, error: chipsError, refetch } =
    useAsync(() => client.chips.list(), []);

  const initialIds = defaultChipIds && defaultChipIds.length > 0 ? defaultChipIds : [];
  const [step, setStep] = useState<Step>(initialIds.length > 0 ? "sql" : "select-chips");
  const [selectedChipIds, setSelectedChipIds] = useState<string[]>(initialIds);
  const [result, setResult] = useState<ChipQueryResult | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onInputActive?.(step === "sql");
    return () => onInputActive?.(false);
  }, [step, onInputActive]);

  const handleExecute = async (rawQuery: string) => {
    if (!rawQuery.trim()) return;
    setStep("executing");
    setError(null);

    try {
      const data = await client.chips.query(selectedChipIds, rawQuery);
      setResult(data);
      setRows(toRecords(data));
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
      setStep("sql");
    }
  };

  useInput(
    (input) => {
      if (step !== "results") return;
      if (input === "r") {
        setResult(null);
        setRows(null);
        setStep("sql");
      }
      if (input === "c") {
        setResult(null);
        setRows(null);
        setSelectedChipIds([]);
        setStep("select-chips");
      }
    },
    { isActive: isFocused },
  );

  if (step === "select-chips") {
    if (chipsLoading) return <Spinner label="Loading chips..." />;
    if (chipsError) return <ErrorDisplay message={chipsError} onRetry={refetch} onBack={onBack} />;

    const sidebarWidth = Math.min(50, Math.floor(termCols * 0.38));
    const panelWidth = termCols - sidebarWidth - 4;
    const { metaMap, index, mainChipIds, cols } = chipDisplayConfig(chipsData, panelWidth, 4);

    if (mainChipIds.length === 0) {
      return (
        <Box paddingY={1}>
          <Text color={brand.muted}>No chips available. Create one first!</Text>
        </Box>
      );
    }

    const options = mainChipIds.map((id) => ({
      label: chipLabel(id, metaMap.get(id), index, cols),
      value: id,
    }));

    const maxVisible = Math.max(5, termRows - 15);
    const visibleCount = Math.min(options.length, maxVisible);
    const hasMore = options.length > visibleCount;

    const headerText = chipHeader(cols);
    const divider = "    " + "─".repeat(Math.min(panelWidth - 4, headerText.length));

    return (
      <Box flexDirection="column" gap={1} paddingY={1}>
        <Box flexDirection="column">
          <Text color={brand.cyan} bold>
            Select chips for raw SQL:
          </Text>
          <Text color={brand.muted}>
            Space to toggle, Enter to confirm · {options.length} chip{options.length !== 1 ? "s" : ""} available
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text color={brand.violet} bold>{headerText}</Text>
          <Text color={brand.border}>{divider}</Text>
          <MultiSelect
            visibleOptionCount={visibleCount}
            options={options}
            onSubmit={(values) => {
              if (values.length > 0) {
                setSelectedChipIds(values);
                setStep("sql");
              }
            }}
          />
        </Box>
        {hasMore && (
          <Text color={brand.muted} dimColor>↑↓ scroll for more</Text>
        )}
      </Box>
    );
  }

  if (step === "sql") {
    const { metaMap: sqlMetaMap, index: sqlIndex } = chipDisplayConfig(chipsData, 0);

    return (
      <Box flexDirection="column" gap={1} paddingY={1}>
        <Text color={brand.cyan} bold>
          Raw SQL
        </Text>
        <Text color={brand.muted}>
          Runs read-only against the chip catalogs directly — no view layer.
          Address tables as s_&lt;chip_id&gt;.main.&lt;table&gt;.
        </Text>
        <Box flexDirection="column">
          {selectedChipIds.map((id) => {
            const meta = sqlMetaMap.get(id);
            const chips = sqlIndex.chipsByChipId.get(id) ?? [];
            const tables = [...new Set(chips.map((c) => c.tableName))];
            const name = meta?.name ?? id.slice(0, 12);
            return (
              <Text key={id} color={brand.muted}>
                {"  "}{name}
                <Text color={brand.violet}>{" [" + tables.join(", ") + "]"}</Text>
                {meta && <Text color={brand.muted} dimColor>{" " + formatDate(meta.createdAt)}</Text>}
              </Text>
            );
          })}
        </Box>
        <Box>
          <Text color={brand.violet}>{"❯ "}</Text>
          <TextInput
            placeholder="SELECT * FROM s_<chip_id>.main.<table> ..."
            onSubmit={handleExecute}
          />
        </Box>
        {error && <Text color={brand.error}>{error}</Text>}
      </Box>
    );
  }

  if (step === "executing") {
    return <Spinner label="Executing raw query..." />;
  }

  const sidebarWidth = Math.min(50, Math.floor(termCols * 0.38));
  const tableWidth = termCols - sidebarWidth - 4;
  const tableHeight = termRows - 12;

  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color={brand.success} bold>
        Raw Query Results
      </Text>
      <Box gap={1}>
        <Text color={brand.muted}>
          {result?.columns.length ?? 0} columns · {rows?.length ?? 0} rows
        </Text>
        {result?.truncated && (
          <Text color={brand.error}>truncated at server row cap</Text>
        )}
      </Box>
      {rows && (
        <TableView
          data={rows}
          viewWidth={tableWidth}
          viewHeight={tableHeight}
          emptyMessage="Query returned no rows"
          isActive={isFocused}
        />
      )}
      <Box gap={2}>
        <Text color={brand.muted}>r:new query</Text>
        <Text color={brand.muted}>c:change chips</Text>
      </Box>
    </Box>
  );
}
