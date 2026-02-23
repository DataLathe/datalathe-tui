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
  | "chip-name"
  | "partition"
  | "partition-mode"
  | "partition-query"
  | "partition-values"
  | "confirm"
  | "creating"
  | "done";

/** Steps with TextInput or FilePathInput that consume letter keys. */
const INPUT_ACTIVE_STEPS: Step[] = [
  "table",
  "query",
  "file-path",
  "chip-name",
  "partition",
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
  const [chipName, setChipName] = useState("");
  const [chipId, setChipId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getDefaultChipName = (): string => {
    if (sourceType === "file") {
      const fileName = filePath.split("/").pop() ?? filePath;
      return fileName.replace(/\.[^.]+$/, "");
    }
    return tableName || source;
  };

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
      const name = chipName || getDefaultChipName();
      if (sourceType === "file") {
        id = await client.createChipFromFile(filePath, undefined, partition, name);
      } else {
        id = await client.createChip(source, query, tableName, partition, name);
      }
      setChipId(id);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create chip");
      setStep("confirm");
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
                  setStep("chip-name");
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
          <FilePathInput onSubmit={(p) => { setFilePath(p); setStep("chip-name"); }} />
          {error && <Text color={brand.error}>{error}</Text>}
        </Box>
      )}

      {step === "chip-name" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Chip name (Enter for default):</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder={getDefaultChipName()}
              onSubmit={(v) => {
                if (v.trim()) {
                  setChipName(v.trim());
                } else {
                  setChipName(getDefaultChipName());
                }
                setStep("partition");
              }}
            />
          </Box>
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
                  setStep("partition-mode");
                } else {
                  setStep("confirm");
                }
              }}
            />
          </Box>
          {error && <Text color={brand.error}>{error}</Text>}
        </Box>
      )}

      {step === "partition-mode" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.muted}>Partition by: {partitionBy}</Text>
          <Text color={brand.text}>How should partition values be determined?</Text>
          <Select
            options={[
              { label: "Column only — no specific values", value: "column-only" },
              { label: "Provide values — comma-separated list", value: "values" },
              { label: "Use a query — SQL to derive values", value: "query" },
            ]}
            onChange={(value) => {
              if (value === "column-only") {
                setPartitionQuery("");
                setPartitionValues("");
                setStep("confirm");
              } else if (value === "values") {
                setPartitionQuery("");
                setStep("partition-values");
              } else {
                setPartitionValues("");
                setStep("partition-query");
              }
            }}
          />
        </Box>
      )}

      {step === "partition-query" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.muted}>Partition by: {partitionBy}</Text>
          <Text color={brand.text}>Partition query (SQL to derive values):</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="SELECT DISTINCT col FROM table"
              onSubmit={(v) => {
                if (v.trim()) setPartitionQuery(v.trim());
                setStep("confirm");
              }}
            />
          </Box>
        </Box>
      )}

      {step === "partition-values" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.muted}>Partition by: {partitionBy}</Text>
          <Text color={brand.text}>Partition values (comma-separated):</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="val1, val2, val3"
              onSubmit={(v) => {
                if (v.trim()) setPartitionValues(v.trim());
                setStep("confirm");
              }}
            />
          </Box>
        </Box>
      )}

      {step === "confirm" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.cyan} bold>─── Confirm Chip Settings ───</Text>
          <Box flexDirection="column" paddingLeft={1}>
            <Text>
              <Text color={brand.muted}>Name        </Text>
              <Text color={brand.text}>{chipName || getDefaultChipName()}</Text>
            </Text>
            <Text>
              <Text color={brand.muted}>Source Type  </Text>
              <Text color={brand.text}>{sourceType === "file" ? "File" : "Database"}</Text>
            </Text>
            {sourceType === "file" ? (
              <Text>
                <Text color={brand.muted}>File Path   </Text>
                <Text color={brand.text}>{filePath}</Text>
              </Text>
            ) : (
              <>
                <Text>
                  <Text color={brand.muted}>Database    </Text>
                  <Text color={brand.text}>{source}</Text>
                </Text>
                <Text>
                  <Text color={brand.muted}>Table       </Text>
                  <Text color={brand.text}>{tableName}</Text>
                </Text>
                <Text>
                  <Text color={brand.muted}>Query       </Text>
                  <Text color={brand.text}>{query}</Text>
                </Text>
              </>
            )}
            {partitionBy ? (
              <>
                <Text color={brand.cyan} bold>{"\n"}Partition</Text>
                <Text>
                  <Text color={brand.muted}>Column      </Text>
                  <Text color={brand.text}>{partitionBy}</Text>
                </Text>
                {partitionValues && (
                  <Text>
                    <Text color={brand.muted}>Values      </Text>
                    <Text color={brand.text}>{partitionValues}</Text>
                  </Text>
                )}
                {partitionQuery && (
                  <Text>
                    <Text color={brand.muted}>Query       </Text>
                    <Text color={brand.text}>{partitionQuery}</Text>
                  </Text>
                )}
              </>
            ) : (
              <Text>
                <Text color={brand.muted}>Partition   </Text>
                <Text color={brand.text}>None</Text>
              </Text>
            )}
          </Box>
          <Box marginTop={1}>
            <Select
              options={[
                { label: "Create Chip", value: "create" },
                { label: "Go Back", value: "back" },
              ]}
              onChange={(value) => {
                if (value === "create") {
                  handleCreate();
                } else {
                  setStep("partition");
                }
              }}
            />
          </Box>
          {error && <Text color={brand.error}>{error}</Text>}
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

