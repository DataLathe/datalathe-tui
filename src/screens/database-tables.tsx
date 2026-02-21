import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { Spinner, Select } from "@inkjs/ui";
import { useClient } from "../hooks/use-client.js";
import { useAsync } from "../hooks/use-async.js";
import { useTerminalSize } from "../hooks/use-terminal-size.js";
import { TableView } from "../components/table-view.js";
import { ErrorDisplay } from "../components/error-display.js";
import { brand } from "../theme.js";
import type { DatabaseTable } from "@datalathe/client";

interface DatabaseTablesScreenProps {
  databaseName: string;
  onCreateChip: (databaseName: string, tableName: string) => void;
  onBack: () => void;
}

function groupByTable(tables: DatabaseTable[]) {
  const grouped = new Map<string, DatabaseTable[]>();
  for (const row of tables) {
    const key = `${row.schema_name}.${row.table_name}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }
  return grouped;
}

export function DatabaseTablesScreen({
  databaseName,
  onCreateChip,
  onBack,
}: DatabaseTablesScreenProps) {
  const { columns: termCols, rows: termRows } = useTerminalSize();
  const client = useClient();
  const { data, loading, error, refetch } = useAsync(
    () => client.getDatabaseSchema(databaseName),
    [databaseName],
  );
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Handle keys when viewing a specific table's columns
  useInput((input, key) => {
    if (!selectedTable) return;
    if (key.leftArrow) {
      setSelectedTable(null);
    }
    if (input === "c") {
      // Extract just the table_name (without schema prefix) for chip creation
      const tableName = selectedTable.includes(".")
        ? selectedTable.split(".").pop()!
        : selectedTable;
      onCreateChip(databaseName, tableName);
    }
  });

  if (loading) {
    return <Spinner label={`Loading schema for ${databaseName}...`} />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={refetch} onBack={onBack} />;
  }

  const tables = groupByTable(data ?? []);

  if (tables.size === 0) {
    return (
      <Box paddingY={1}>
        <Text color={brand.muted}>No tables found in {databaseName}.</Text>
      </Box>
    );
  }

  if (selectedTable && tables.has(selectedTable)) {
    const columns = tables.get(selectedTable)!;
    const tableData = columns.map((col) => ({
      column: col.column_name,
      type: col.data_type,
      nullable: col.is_nullable,
      default: col.column_default ?? "",
    }));

    return (
      <Box flexDirection="column" gap={1} paddingY={1}>
        <Box gap={2}>
          <Text color={brand.cyan} bold>
            {selectedTable}
          </Text>
          <Text color={brand.muted}>({columns.length} columns)</Text>
        </Box>
        <TableView
          data={tableData}
          viewWidth={termCols - Math.min(50, Math.floor(termCols * 0.38)) - 4}
          viewHeight={termRows - 12}
        />
        <Box gap={2}>
          <Text color={brand.muted}>←:back to tables</Text>
          <Text color={brand.muted}>c:create chip from this table</Text>
        </Box>
      </Box>
    );
  }

  const options = Array.from(tables.entries()).map(([name, cols]) => ({
    label: name,
    value: name,
    description: `${cols.length} columns`,
  }));

  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color={brand.cyan} bold>
        {databaseName} — Tables ({tables.size})
      </Text>
      <Select
        options={options}
        onChange={(value) => setSelectedTable(value)}
      />
    </Box>
  );
}
