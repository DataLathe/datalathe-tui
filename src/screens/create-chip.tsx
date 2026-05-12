import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { TextInput, Spinner } from "@inkjs/ui";
import { useClient } from "../hooks/use-client.js";
import { useAsync } from "../hooks/use-async.js";
import { FilePathInput } from "../components/file-path-input.js";
import { MenuSelect } from "../components/menu-select.js";
import { brand } from "../theme.js";
import type { DuckDBDatabase, Partition, S3StorageConfig } from "@datalathe/client";

type Step =
  | "choose-source"
  | "select-db"
  | "table"
  | "query"
  | "file-path"
  | "s3-path"
  | "chip-name"
  | "tags"
  | "partition"
  | "partition-mode"
  | "partition-query"
  | "partition-values"
  | "column-replace"
  | "streaming"
  | "streaming-column"
  | "storage-config"
  | "storage-bucket"
  | "storage-prefix"
  | "storage-ttl"
  | "confirm"
  | "creating"
  | "done";

/** Steps with TextInput or FilePathInput that consume letter keys. */
const INPUT_ACTIVE_STEPS: Step[] = [
  "table",
  "query",
  "file-path",
  "s3-path",
  "chip-name",
  "tags",
  "partition",
  "partition-query",
  "partition-values",
  "column-replace",
  "streaming-column",
  "storage-bucket",
  "storage-prefix",
  "storage-ttl",
];

interface CreateChipScreenProps {
  initialSource?: string;
  initialTable?: string;
  onDone: (chipId: string) => void;
  onBack: () => void;
  onInputActive?: (active: boolean) => void;
  isFocused?: boolean;
}

export function CreateChipScreen({
  initialSource,
  initialTable,
  onDone,
  onBack,
  onInputActive,
  isFocused = true,
}: CreateChipScreenProps) {
  const client = useClient();

  // If coming from sidebar with a source pre-selected, skip to query
  const initialStep: Step = initialSource ? "query" : "choose-source";
  const [step, setStep] = useState<Step>(initialStep);
  const [sourceType, setSourceType] = useState<"database" | "file" | "s3">(
    initialSource ? "database" : "database",
  );
  const [source, setSource] = useState(initialSource ?? "");
  const [tableName, setTableName] = useState(initialTable ?? "");
  const [filePath, setFilePath] = useState("");
  const [s3Path, setS3Path] = useState("");
  const [partitionBy, setPartitionBy] = useState("");
  const [partitionQuery, setPartitionQuery] = useState("");
  const [partitionValues, setPartitionValues] = useState("");
  const [chipName, setChipName] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [columnReplaceInput, setColumnReplaceInput] = useState("");
  const [storageBucket, setStorageBucket] = useState("");
  const [storagePrefix, setStoragePrefix] = useState("");
  const [storageTtl, setStorageTtl] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingColumn, setStreamingColumn] = useState("");
  const [chipId, setChipId] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState<number | undefined>(undefined);
  const [elapsedMs, setElapsedMs] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const getDefaultChipName = (): string => {
    if (sourceType === "file") {
      const fileName = filePath.split("/").pop() ?? filePath;
      return fileName.replace(/\.[^.]+$/, "");
    }
    if (sourceType === "s3") {
      const fileName = s3Path.split("/").pop() ?? s3Path;
      return fileName.replace(/\.[^.]+$/, "");
    }
    return tableName || source;
  };

  const buildPartition = (): Partition | undefined => {
    if (!partitionBy) return undefined;
    const p: Partition = { partitionBy: partitionBy };
    if (partitionQuery) p.partitionQuery = partitionQuery;
    if (partitionValues) {
      p.partitionValues = partitionValues.split(",").map((v) => v.trim()).filter(Boolean);
    }
    return p;
  };

  const buildStorageConfig = (): S3StorageConfig | undefined => {
    if (!storageBucket && !storagePrefix && !storageTtl) return undefined;
    const config: S3StorageConfig = {};
    if (storageBucket) config.bucket = storageBucket;
    if (storagePrefix) config.keyPrefix = storagePrefix;
    if (storageTtl) {
      const days = parseInt(storageTtl, 10);
      if (!isNaN(days) && days > 0) config.ttlDays = days;
    }
    return Object.keys(config).length > 0 ? config : undefined;
  };

  const buildTags = (): Record<string, string> | undefined => {
    if (!tagsInput.trim()) return undefined;
    const map: Record<string, string> = {};
    for (const pair of tagsInput.split(",")) {
      const [key, value] = pair.split("=").map((s) => s.trim());
      if (key && value) map[key] = value;
    }
    return Object.keys(map).length > 0 ? map : undefined;
  };

  const buildColumnReplace = (): Record<string, string> | undefined => {
    if (!columnReplaceInput.trim()) return undefined;
    const map: Record<string, string> = {};
    for (const pair of columnReplaceInput.split(",")) {
      const [old, newName] = pair.split("=").map((s) => s.trim());
      if (old && newName) map[old] = newName;
    }
    return Object.keys(map).length > 0 ? map : undefined;
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
    const columnReplace = buildColumnReplace();
    const storageConfig = buildStorageConfig();
    const tags = buildTags();
    try {
      let id: string;
      const name = chipName || getDefaultChipName();
      if (sourceType === "file") {
        id = await client.chips.createFromFile(filePath, undefined, partition, name, columnReplace, storageConfig);
      } else if (sourceType === "s3") {
        id = await client.chips.createFromS3(s3Path, undefined, name, columnReplace, storageConfig);
      } else {
        const col = streamingColumn.trim() || undefined;
        id = await client.chips.create(source, query, tableName, partition, name, columnReplace, storageConfig, streaming || undefined, col);
      }
      // Apply tags after chip creation
      if (tags && id) {
        await client.chips.addTags(id, tags);
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
          <MenuSelect
            isDisabled={!isFocused}
            options={[
              { label: "Database", value: "database", description: "Query a connected database" },
              { label: "File", value: "file", description: "CSV, Parquet, or other local file" },
              { label: "S3 Object", value: "s3", description: "CSV, Parquet, or other file in S3" },
            ]}
            onChange={(value) => {
              if (value === "file") {
                setSourceType("file");
                setStep("file-path");
              } else if (value === "s3") {
                setSourceType("s3");
                setStep("s3-path");
              } else {
                setSourceType("database");
                setStep("select-db");
              }
            }}
          />
        </Box>
      )}

      {step === "select-db" && <DatabaseSelect onSelect={(db) => { setSource(db); setStep("table"); }} isFocused={isFocused} />}

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

      {step === "s3-path" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>S3 path:</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="s3://bucket/path/file.csv"
              onSubmit={(v) => {
                if (v.trim()) {
                  setS3Path(v.trim());
                  setStep("chip-name");
                }
              }}
            />
          </Box>
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
                setStep("tags");
              }}
            />
          </Box>
        </Box>
      )}

      {step === "tags" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Tags (Enter to skip):</Text>
          <Text color={brand.muted}>Format: key1=value1, key2=value2</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="env=prod, tenant_id=acme"
              onSubmit={(v) => {
                if (v.trim()) setTagsInput(v.trim());
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
                  setStep("column-replace");
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
          <MenuSelect
            isDisabled={!isFocused}
            options={[
              { label: "Column only", value: "column-only", description: "No specific values" },
              { label: "Provide values", value: "values", description: "Comma-separated list" },
              { label: "Use a query", value: "query", description: "SQL to derive values" },
            ]}
            onChange={(value) => {
              if (value === "column-only") {
                setPartitionQuery("");
                setPartitionValues("");
                setStep("column-replace");
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
                setStep("column-replace");
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
                setStep("column-replace");
              }}
            />
          </Box>
        </Box>
      )}

      {step === "column-replace" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Column replace (Enter to skip):</Text>
          <Text color={brand.muted}>Format: old1=new1, old2=new2</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="optional"
              onSubmit={(v) => {
                if (v.trim()) setColumnReplaceInput(v.trim());
                setStep(sourceType === "database" ? "streaming" : "storage-config");
              }}
            />
          </Box>
        </Box>
      )}

      {step === "streaming" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Use streaming ingest?</Text>
          <Text color={brand.muted}>Recommended for tables with more than 10M rows.</Text>
          <MenuSelect
            isDisabled={!isFocused}
            options={[
              { label: "No", value: "no", description: "Standard ingest" },
              { label: "Yes", value: "yes", description: "Streaming ingest" },
            ]}
            onChange={(value) => {
              const enabled = value === "yes";
              setStreaming(enabled);
              setStreamingColumn("");
              setStep(enabled ? "streaming-column" : "storage-config");
            }}
          />
        </Box>
      )}

      {step === "streaming-column" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Partition column (Enter to skip):</Text>
          <Text color={brand.muted}>Numeric primary-key column for parallel chunked load.</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="optional"
              onSubmit={(v) => {
                if (v.trim()) setStreamingColumn(v.trim());
                setStep("storage-config");
              }}
            />
          </Box>
        </Box>
      )}

      {step === "storage-config" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Configure S3 storage?</Text>
          <MenuSelect
            isDisabled={!isFocused}
            options={[
              { label: "No", value: "no", description: "Use defaults" },
              { label: "Yes", value: "yes", description: "Custom bucket/prefix/TTL" },
            ]}
            onChange={(value) => {
              if (value === "yes") {
                setStep("storage-bucket");
              } else {
                setStep("confirm");
              }
            }}
          />
        </Box>
      )}

      {step === "storage-bucket" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>S3 bucket (Enter to skip):</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="my-bucket"
              onSubmit={(v) => {
                if (v.trim()) setStorageBucket(v.trim());
                setStep("storage-prefix");
              }}
            />
          </Box>
        </Box>
      )}

      {step === "storage-prefix" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>S3 key prefix (Enter to skip):</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="chips/project-a/"
              onSubmit={(v) => {
                if (v.trim()) setStoragePrefix(v.trim());
                setStep("storage-ttl");
              }}
            />
          </Box>
        </Box>
      )}

      {step === "storage-ttl" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>TTL in days (Enter to skip):</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="30"
              onSubmit={(v) => {
                if (v.trim()) setStorageTtl(v.trim());
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
              <Text color={brand.text}>{sourceType === "file" ? "File" : sourceType === "s3" ? "S3" : "Database"}</Text>
            </Text>
            {sourceType === "file" ? (
              <Text>
                <Text color={brand.muted}>File Path   </Text>
                <Text color={brand.text}>{filePath}</Text>
              </Text>
            ) : sourceType === "s3" ? (
              <Text>
                <Text color={brand.muted}>S3 Path     </Text>
                <Text color={brand.text}>{s3Path}</Text>
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
                <Text>
                  <Text color={brand.muted}>Streaming   </Text>
                  <Text color={brand.text}>{streaming ? "Yes" : "No"}</Text>
                </Text>
                {streaming && (
                  <Text>
                    <Text color={brand.muted}>Part. Col   </Text>
                    <Text color={brand.text}>{streamingColumn || "None"}</Text>
                  </Text>
                )}
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
            {columnReplaceInput ? (
              <Text>
                <Text color={brand.muted}>Col Replace </Text>
                <Text color={brand.text}>{columnReplaceInput}</Text>
              </Text>
            ) : (
              <Text>
                <Text color={brand.muted}>Col Replace </Text>
                <Text color={brand.text}>None</Text>
              </Text>
            )}
            {tagsInput ? (
              <Text>
                <Text color={brand.muted}>Tags        </Text>
                <Text color={brand.text}>{tagsInput}</Text>
              </Text>
            ) : (
              <Text>
                <Text color={brand.muted}>Tags        </Text>
                <Text color={brand.text}>None</Text>
              </Text>
            )}
            {(storageBucket || storagePrefix || storageTtl) ? (
              <>
                <Text color={brand.cyan} bold>{"\n"}S3 Storage</Text>
                {storageBucket && (
                  <Text>
                    <Text color={brand.muted}>Bucket      </Text>
                    <Text color={brand.text}>{storageBucket}</Text>
                  </Text>
                )}
                {storagePrefix && (
                  <Text>
                    <Text color={brand.muted}>Key Prefix  </Text>
                    <Text color={brand.text}>{storagePrefix}</Text>
                  </Text>
                )}
                {storageTtl && (
                  <Text>
                    <Text color={brand.muted}>TTL (days)  </Text>
                    <Text color={brand.text}>{storageTtl}</Text>
                  </Text>
                )}
              </>
            ) : (
              <Text>
                <Text color={brand.muted}>S3 Storage  </Text>
                <Text color={brand.text}>Default</Text>
              </Text>
            )}
          </Box>
          <Box marginTop={1}>
            <MenuSelect
              isDisabled={!isFocused}
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
          {totalRows !== undefined && (
            <Text color={brand.text}>
              Rows: <Text color={brand.cyan}>{totalRows.toLocaleString()}</Text>
            </Text>
          )}
          {elapsedMs !== undefined && (
            <Text color={brand.text}>
              Time: <Text color={brand.cyan}>{elapsedMs}ms</Text>
            </Text>
          )}
          <Text color={brand.muted}>
            Press b to go back.
          </Text>
        </Box>
      )}
    </Box>
  );
}

function DatabaseSelect({ onSelect, isFocused = true }: { onSelect: (db: string) => void; isFocused?: boolean }) {
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
    label: db.databaseName,
    value: db.databaseName,
  }));

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={brand.text}>Select database:</Text>
      <MenuSelect isDisabled={!isFocused} options={options} visibleCount={10} onChange={onSelect} />
    </Box>
  );
}

