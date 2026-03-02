import React, { useState, useEffect, useCallback } from "react";
import { execSync } from "child_process";
import { Box, Text, useInput } from "ink";
import { TextInput, Spinner, MultiSelect, Select } from "@inkjs/ui";
import { DatalatheResultSet } from "@datalathe/client";
import type { ChipMetadata, Chip, SchemaField, ReportTiming } from "@datalathe/client";
import { useClient } from "../hooks/use-client.js";
import { useAsync } from "../hooks/use-async.js";
import { useTerminalSize } from "../hooks/use-terminal-size.js";
import { TableView } from "../components/table-view.js";
import { ErrorDisplay } from "../components/error-display.js";
import { brand } from "../theme.js";
import { formatDate, chipColumns, chipLabel, chipHeader, hasAnySubChips } from "../utils/chip-options.js";

type Step = "select-chips" | "transform-option" | "sql" | "executing" | "results";

interface QueryScreenProps {
  defaultChipIds?: string[];
  onBack: () => void;
  onInputActive?: (active: boolean) => void;
  isFocused: boolean;
}

export function QueryScreen({ defaultChipIds, onBack, onInputActive, isFocused }: QueryScreenProps) {
  const { columns: termCols, rows: termRows } = useTerminalSize();
  const client = useClient();
  const { data: chipsData, loading: chipsLoading, error: chipsError, refetch } =
    useAsync(() => client.listChips(), []);

  const initialIds = defaultChipIds && defaultChipIds.length > 0 ? defaultChipIds : [];
  const [step, setStep] = useState<Step>(initialIds.length > 0 ? "transform-option" : "select-chips");
  const [selectedChipIds, setSelectedChipIds] = useState<string[]>(initialIds);
  const [transformQuery, setTransformQuery] = useState(false);
  const [transformedQuery, setTransformedQuery] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [resultSchema, setResultSchema] = useState<SchemaField[]>([]);
  const [resultInfo, setResultInfo] = useState<string>("");
  const [showMetadata, setShowMetadata] = useState(false);
  const [timing, setTiming] = useState<ReportTiming | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copyChipIds = useCallback(() => {
    const json = JSON.stringify(selectedChipIds);
    try {
      execSync("pbcopy", { input: json });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [selectedChipIds]);

  // Only mark TextInput steps as input-active (blocks global keys like 'b' and 'q').
  // Select/MultiSelect steps use arrow keys and don't need this.
  useEffect(() => {
    onInputActive?.(step === "sql");
    return () => onInputActive?.(false);
  }, [step, onInputActive]);

  const handleExecute = async (rawQuery: string) => {
    if (!rawQuery.trim()) return;
    setStep("executing");
    setError(null);
    setTransformedQuery(null);

    // Auto-append LIMIT to prevent OOM on large result sets
    const DEFAULT_LIMIT = 200;
    const hasLimit = /\bLIMIT\s+\d+/i.test(rawQuery);
    const query = hasLimit ? rawQuery : `${rawQuery.replace(/;\s*$/, "")} LIMIT ${DEFAULT_LIMIT}`;

    try {
      const report = await client.generateReport(
        selectedChipIds,
        [query],
        undefined,
        transformQuery || undefined,
        transformQuery || undefined,
      );
      setTiming(report.timing);
      const entry = report.results.get(0);

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

      if (entry.transformed_query) {
        setTransformedQuery(entry.transformed_query);
      }

      const rs = new DatalatheResultSet(entry);
      const rows = rs.toArray();
      const schema = entry.schema ?? [];
      setResults(rows);
      setResultSchema(schema);
      setShowMetadata(false);
      const limitNote = !hasLimit && rows.length >= DEFAULT_LIMIT ? ` (limited to ${DEFAULT_LIMIT})` : "";
      setResultInfo(
        `${schema.length} columns · ${rows.length} rows${limitNote}`,
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
      if (input === "m") {
        setShowMetadata((prev) => !prev);
      }
      if (input === "r") {
        setResults(null);
        setStep("sql");
      }
      if (input === "c") {
        setResults(null);
        setTransformedQuery(null);
        setSelectedChipIds([]);
        setTransformQuery(false);
        setStep("select-chips");
      }
      if (input === "y") {
        copyChipIds();
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

    // Compute column layout based on available panel width
    const sidebarWidth = Math.min(50, Math.floor(termCols * 0.38));
    const panelWidth = termCols - sidebarWidth - 4;
    const showSubs = hasAnySubChips(allChips);
    const cols = chipColumns(panelWidth, 4, showSubs);

    const options = uniqueIds.map((id) => ({
      label: chipLabel(id, metadataMap.get(id), allChips, cols),
      value: id,
    }));

    // Use available terminal height: subtract header/status/border/padding/title/hint/header-row/divider/gaps
    const maxVisible = Math.max(5, termRows - 15);
    const visibleCount = Math.min(options.length, maxVisible);
    const hasMore = options.length > visibleCount;

    // Build header with same column widths
    const headerText = chipHeader(cols);
    const divider = "    " + "─".repeat(Math.min(panelWidth - 4, headerText.length));

    return (
      <Box flexDirection="column" gap={1} paddingY={1}>
        <Box flexDirection="column">
          <Text color={brand.cyan} bold>
            Select chips to query:
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
                setStep("transform-option");
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

  if (step === "transform-option") {
    return (
      <Box flexDirection="column" gap={1} paddingY={1}>
        <Text color={brand.cyan} bold>
          Query Transformation
        </Text>
        <Text color={brand.muted}>
          Sanitize MySQL/MariaDB syntax before executing?
        </Text>
        <Select
          options={[
            { label: "No — run query as-is", value: "no" },
            { label: "Yes — sanitize MySQL/MariaDB syntax", value: "yes" },
          ]}
          onChange={(value) => {
            setTransformQuery(value === "yes");
            setStep("sql");
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
          <Box gap={1}>
            <Text color={brand.text}>Enter SQL:</Text>
            {transformQuery && <Text color={brand.violet}>[transform: on]</Text>}
          </Box>
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
      {transformedQuery && (
        <Box flexDirection="column">
          <Text color={brand.violet} bold>Transformed query:</Text>
          <Text color={brand.muted}>{transformedQuery}</Text>
        </Box>
      )}
      {showMetadata ? (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.cyan} bold>Schema</Text>
          <Box flexDirection="column">
            {resultSchema.map((field, i) => (
              <Text key={i}>
                <Text color={brand.text}>{field.name}</Text>
                <Text color={brand.muted}>{" — "}{field.data_type}</Text>
              </Text>
            ))}
          </Box>
          {timing && (
            <>
              <Text color={brand.cyan} bold>Timing</Text>
              <Box flexDirection="column">
                <Text color={brand.muted}>  Total: {timing.total_ms}ms</Text>
                <Text color={brand.muted}>  Chip attach: {timing.chip_attach_ms}ms</Text>
                <Text color={brand.muted}>  Query execution: {timing.query_execution_ms}ms</Text>
              </Box>
            </>
          )}
          {selectedChipIds.length > 0 && (
            <>
              <Text color={brand.cyan} bold>Chips</Text>
              <Box flexDirection="column">
                {selectedChipIds.map((id) => (
                  <Text key={id} color={brand.muted}>  {id}</Text>
                ))}
              </Box>
            </>
          )}
        </Box>
      ) : (
        results && (
          <TableView
            data={results}
            viewWidth={tableWidth}
            viewHeight={tableHeight}
            emptyMessage="Query returned no rows"
            isActive={isFocused}
          />
        )
      )}
      <Box gap={2}>
        <Text color={brand.muted}>m:metadata  r:run another  c:change chips  y:copy chip ids  b:back</Text>
        {copied && <Text color={brand.success}>Copied!</Text>}
      </Box>
    </Box>
  );
}
