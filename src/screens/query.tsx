import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput, Spinner, MultiSelect } from "@inkjs/ui";
import { DatalatheResultSet } from "@datalathe/client";
import type { ChipMetadata, Chip } from "@datalathe/client";
import { useClient } from "../hooks/use-client.js";
import { useAsync } from "../hooks/use-async.js";
import { useTerminalSize } from "../hooks/use-terminal-size.js";
import { TableView } from "../components/table-view.js";
import { ErrorDisplay } from "../components/error-display.js";
import { brand } from "../theme.js";

type Step = "select-chips" | "sql" | "executing" | "results";

interface QueryScreenProps {
  defaultChipIds?: string[];
  onBack: () => void;
  onInputActive?: (active: boolean) => void;
  isFocused: boolean;
}

function formatDate(epoch: number): string {
  return new Date(epoch * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Build a display label showing chip name, table, and creation date. */
function chipLabel(
  id: string,
  meta: ChipMetadata | undefined,
  chips: Chip[],
): string {
  const name = meta?.name ?? id.slice(0, 12);
  const tables = [...new Set(chips.filter((c) => c.chip_id === id).map((c) => c.table_name))];
  const table = tables.length > 0 ? tables.join(", ") : "—";
  const created = meta ? formatDate(meta.created_at) : "—";
  return `${name}  [${table}]  ${created}`;
}

export function QueryScreen({ defaultChipIds, onBack, onInputActive, isFocused }: QueryScreenProps) {
  const { columns: termCols, rows: termRows } = useTerminalSize();
  const client = useClient();
  const { data: chipsData, loading: chipsLoading, error: chipsError, refetch } =
    useAsync(() => client.listChips(), []);

  const initialIds = defaultChipIds && defaultChipIds.length > 0 ? defaultChipIds : [];
  const [step, setStep] = useState<Step>(initialIds.length > 0 ? "sql" : "select-chips");
  const [selectedChipIds, setSelectedChipIds] = useState<string[]>(initialIds);
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [resultInfo, setResultInfo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Notify parent when text input is active
  useEffect(() => {
    onInputActive?.(step === "sql" || step === "select-chips");
    return () => onInputActive?.(false);
  }, [step, onInputActive]);

  const handleExecute = async (query: string) => {
    if (!query.trim()) return;
    setStep("executing");
    setError(null);

    try {
      const reportResults = await client.generateReport(selectedChipIds, [query]);
      const entry = reportResults.get(0);

      if (!entry) {
        setError("No results returned");
        setStep("sql");
        return;
      }

      if (entry.error) {
        setError(entry.error);
        setStep("sql");
        return;
      }

      const rs = new DatalatheResultSet(entry);
      const rows = rs.toArray();
      const schema = entry.schema ?? [];
      setResults(rows);
      setResultInfo(
        `${schema.length} columns · ${rows.length} rows`,
      );
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
      setStep("sql");
    }
  };

  // Post-results key handling
  useInput(
    (input) => {
      if (step !== "results") return;
      if (input === "r") {
        setResults(null);
        setStep("sql");
      }
      if (input === "c") {
        setResults(null);
        setSelectedChipIds([]);
        setStep("select-chips");
      }
    },
    { isActive: isFocused },
  );

  if (step === "select-chips") {
    if (chipsLoading) return <Spinner label="Loading chips..." />;
    if (chipsError) return <ErrorDisplay message={chipsError} onRetry={refetch} onBack={onBack} />;

    const metadataMap = new Map<string, ChipMetadata>();
    for (const m of chipsData?.metadata ?? []) {
      metadataMap.set(m.chip_id, m);
    }
    const allChips = chipsData?.chips ?? [];
    // Only show main chips (chip_id === sub_chip_id)
    const mainChips = allChips.filter((c) => c.chip_id === c.sub_chip_id);
    const uniqueIds = [...new Set(mainChips.map((c) => c.chip_id))];

    if (uniqueIds.length === 0) {
      return (
        <Box paddingY={1}>
          <Text color={brand.muted}>No chips available. Create one first!</Text>
        </Box>
      );
    }

    const options = uniqueIds.map((id) => ({
      label: chipLabel(id, metadataMap.get(id), allChips),
      value: id,
    }));

    return (
      <Box flexDirection="column" gap={1} paddingY={1}>
        <Text color={brand.cyan} bold>
          Select chips to query:
        </Text>
        <Text color={brand.muted}>
          Space to toggle, Enter to confirm
        </Text>
        <MultiSelect
          options={options}
          onSubmit={(values) => {
            if (values.length > 0) {
              setSelectedChipIds(values);
              setStep("sql");
            }
          }}
        />
      </Box>
    );
  }

  if (step === "sql") {
    // Build chip summary for display
    const metadataMap = new Map<string, ChipMetadata>();
    for (const m of chipsData?.metadata ?? []) {
      metadataMap.set(m.chip_id, m);
    }
    const allChips = chipsData?.chips ?? [];

    return (
      <Box flexDirection="column" gap={1} paddingY={1}>
        <Text color={brand.cyan} bold>
          Query Chips
        </Text>
        <Box flexDirection="column">
          {selectedChipIds.map((id) => {
            const meta = metadataMap.get(id);
            const tables = [...new Set(allChips.filter((c) => c.chip_id === id).map((c) => c.table_name))];
            const name = meta?.name ?? id.slice(0, 12);
            return (
              <Text key={id} color={brand.muted}>
                {"  "}{name}
                <Text color={brand.violet}>{" [" + tables.join(", ") + "]"}</Text>
                {meta && <Text color={brand.muted} dimColor>{" " + formatDate(meta.created_at)}</Text>}
              </Text>
            );
          })}
        </Box>
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Enter SQL:</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="SELECT * FROM ..."
              onSubmit={handleExecute}
            />
          </Box>
        </Box>
        {error && <Text color={brand.error}>{error}</Text>}
      </Box>
    );
  }

  if (step === "executing") {
    return <Spinner label="Executing query..." />;
  }

  // results step
  // Compute available space for the table:
  // main panel inner width = termCols - sidebar - border(2) - paddingX(2)
  const sidebarWidth = Math.min(50, Math.floor(termCols * 0.38));
  const tableWidth = termCols - sidebarWidth - 4;
  // height: termRows - header(1) - status(1) - border(2) - paddingY(2) - title(1) - info(1) - footer(1) - gaps(3)
  const tableHeight = termRows - 12;

  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color={brand.success} bold>
        Query Results
      </Text>
      <Text color={brand.muted}>{resultInfo}</Text>
      {results && (
        <TableView
          data={results}
          viewWidth={tableWidth}
          viewHeight={tableHeight}
          emptyMessage="Query returned no rows"
          isActive={isFocused}
        />
      )}
      <Box gap={2}>
        <Text color={brand.muted}>r:run another  c:change chips  b:back</Text>
      </Box>
    </Box>
  );
}
