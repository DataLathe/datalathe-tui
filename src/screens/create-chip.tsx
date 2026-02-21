import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { TextInput, Spinner, Select } from "@inkjs/ui";
import { useClient } from "../hooks/use-client.js";
import { useAsync } from "../hooks/use-async.js";
import { FilePathInput } from "../components/file-path-input.js";
import { brand } from "../theme.js";
import type { DuckDBDatabase, Partition } from "@datalathe/client";

type Step =
  | "choose-source"
  | "select-db"
  | "table"
  | "query"
  | "file-path"
  | "partition"
  | "partition-by"
  | "partition-query"
  | "partition-values"
  | "creating"
  | "done";

const INPUT_ACTIVE_STEPS: Step[] = [
  "choose-source",
  "select-db",
  "table",
  "query",
  "file-path",
  "partition",
  "partition-by",
  "partition-query",
  "partition-values",
];

interface CreateChipScreenProps {
  initialSource?: string;
  initialTable?: string;
  onDone: (chipId: string) => void;
  onBack: () => void;
  onInputActive?: (active: boolean) => void;
}

export function CreateChipScreen({
  initialSource,
  initialTable,
  onDone,
  onBack,
  onInputActive,
}: CreateChipScreenProps) {
  const client = useClient();

  // If coming from sidebar with a source pre-selected, skip to query
  const initialStep: Step = initialSource ? "query" : "choose-source";
  const [step, setStep] = useState<Step>(initialStep);
  const [sourceType, setSourceType] = useState<"database" | "file">(
    initialSource ? "database" : "database",
  );
  const [source, setSource] = useState(initialSource ?? "");
  const [tableName, setTableName] = useState(initialTable ?? "");
  const [filePath, setFilePath] = useState("");
  const [partitionBy, setPartitionBy] = useState("");
  const [partitionQuery, setPartitionQuery] = useState("");
  const [partitionValues, setPartitionValues] = useState("");
  const [chipId, setChipId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buildPartition = (): Partition | undefined => {
    if (!partitionBy) return undefined;
    const p: Partition = { partition_by: partitionBy };
    if (partitionQuery) p.partition_query = partitionQuery;
    if (partitionValues) {
      p.partition_values = partitionValues.split(",").map((v) => v.trim()).filter(Boolean);
    }
    return p;
  };

  useEffect(() => {
    onInputActive?.(INPUT_ACTIVE_STEPS.includes(step));
    return () => onInputActive?.(false);
  }, [step, onInputActive]);

  const [query, setQuery] = useState("");

  const handleCreate = async () => {
    setStep("creating");
    setError(null);
    const partition = buildPartition();
    try {
      let id: string;
      if (sourceType === "file") {
        id = await client.createChipFromFile(filePath, undefined, partition);
      } else {
        id = await client.createChip(source, query, tableName, partition);
      }
      setChipId(id);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create chip");
      setStep("partition");
    }
  };

  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color={brand.cyan} bold>
        Create Chip
      </Text>

      {step === "choose-source" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Select source type:</Text>
          <Select
            options={[
              { label: "Database", value: "database" },
              { label: "File (CSV, Parquet, etc.)", value: "file" },
            ]}
            onChange={(value) => {
              if (value === "file") {
                setSourceType("file");
                setStep("file-path");
              } else {
                setSourceType("database");
                setStep("select-db");
              }
            }}
          />
        </Box>
      )}

      {step === "select-db" && <DatabaseSelect onSelect={(db) => { setSource(db); setStep("table"); }} />}

      {step === "table" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.muted}>Database: {source}</Text>
          <Text color={brand.text}>Table name:</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="my_table"
              defaultValue={tableName}
              onChange={(v) => setTableName(v)}
              onSubmit={(v) => {
                if (v.trim()) {
                  setTableName(v);
                  setStep("query");
                }
              }}
            />
          </Box>
        </Box>
      )}

      {step === "query" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.muted}>
            Database: {source} · Table: {tableName}
          </Text>
          <Text color={brand.text}>SQL query:</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder={`SELECT * FROM ${tableName}`}
              onSubmit={(v) => {
                if (v.trim()) {
                  setQuery(v);
                  setStep("partition");
                }
              }}
            />
          </Box>
          {error && <Text color={brand.error}>{error}</Text>}
        </Box>
      )}

      {step === "file-path" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>File path (Tab to complete):</Text>
          <FilePathInput onSubmit={(p) => { setFilePath(p); setStep("partition"); }} />
          {error && <Text color={brand.error}>{error}</Text>}
        </Box>
      )}

      {step === "partition" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Partition by column (Enter to skip):</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="optional"
              onSubmit={(v) => {
                if (v.trim()) {
                  setPartitionBy(v.trim());
                  setStep("partition-query");
                } else {
                  handleCreate();
                }
              }}
            />
          </Box>
          {error && <Text color={brand.error}>{error}</Text>}
        </Box>
      )}

      {step === "partition-query" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.muted}>Partition by: {partitionBy}</Text>
          <Text color={brand.text}>Partition query (Enter to skip):</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="optional — SQL to derive partition values"
              onSubmit={(v) => {
                if (v.trim()) setPartitionQuery(v.trim());
                setStep("partition-values");
              }}
            />
          </Box>
        </Box>
      )}

      {step === "partition-values" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.muted}>Partition by: {partitionBy}</Text>
          {partitionQuery && <Text color={brand.muted}>Partition query: {partitionQuery}</Text>}
          <Text color={brand.text}>Partition values, comma-separated (Enter to skip):</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="optional — e.g. val1,val2,val3"
              onSubmit={(v) => {
                if (v.trim()) setPartitionValues(v.trim());
                handleCreate();
              }}
            />
          </Box>
        </Box>
      )}

      {step === "creating" && <Spinner label="Creating chip..." />}

      {step === "done" && chipId && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.success} bold>
            Chip created successfully!
          </Text>
          <Text color={brand.text}>
            Chip ID: <Text color={brand.cyan}>{chipId}</Text>
          </Text>
          <Text color={brand.muted}>
            Press b to go back.
          </Text>
        </Box>
      )}
    </Box>
  );
}

function DatabaseSelect({ onSelect }: { onSelect: (db: string) => void }) {
  const client = useClient();
  const { data, loading, error } = useAsync(
    () => client.getDatabases(),
    [],
  );

  if (loading) return <Spinner label="Loading databases..." />;
  if (error) return <Text color={brand.error}>{error}</Text>;

  const databases = (data ?? []).filter((db: DuckDBDatabase) => !db.internal);
  if (databases.length === 0) {
    return <Text color={brand.muted}>No databases found.</Text>;
  }

  const options = databases.map((db: DuckDBDatabase) => ({
    label: db.database_name,
    value: db.database_name,
  }));

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={brand.text}>Select database:</Text>
      <Select options={options} onChange={onSelect} />
    </Box>
  );
}

