import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { TextInput, Spinner, Select, MultiSelect } from "@inkjs/ui";
import type { Chip, ChipMetadata } from "@datalathe/client";
import { useClient } from "../hooks/use-client.js";
import { useAsync } from "../hooks/use-async.js";
import { useTerminalSize } from "../hooks/use-terminal-size.js";
import { brand } from "../theme.js";
import { chipColumns, chipLabel, chipHeader, hasAnySubChips } from "../utils/chip-options.js";

type Step =
  | "select-chips"
  | "query"
  | "table-name"
  | "chip-name"
  | "confirm"
  | "creating"
  | "done";

const INPUT_ACTIVE_STEPS: Step[] = ["query", "table-name", "chip-name"];

interface CreateChipFromChipScreenProps {
  defaultChipIds?: string[];
  onDone: (chipId: string) => void;
  onBack: () => void;
  onInputActive?: (active: boolean) => void;
  isFocused: boolean;
}

export function CreateChipFromChipScreen({
  defaultChipIds,
  onDone,
  onBack,
  onInputActive,
  isFocused,
}: CreateChipFromChipScreenProps) {
  const { columns: termCols } = useTerminalSize();
  const client = useClient();
  const { data: chipsData, loading: chipsLoading, error: chipsError, refetch } =
    useAsync(() => client.listChips(), []);

  const initialIds = defaultChipIds && defaultChipIds.length > 0 ? defaultChipIds : [];
  const [step, setStep] = useState<Step>(initialIds.length > 0 ? "query" : "select-chips");
  const [selectedChipIds, setSelectedChipIds] = useState<string[]>(initialIds);
  const [query, setQuery] = useState("");
  const [tableName, setTableName] = useState("");
  const [chipName, setChipName] = useState("");
  const [chipId, setChipId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onInputActive?.(INPUT_ACTIVE_STEPS.includes(step));
    return () => onInputActive?.(false);
  }, [step, onInputActive]);

  const getDefaultChipName = (): string => {
    return tableName || "chip_from_cache";
  };

  const handleCreate = async () => {
    setStep("creating");
    setError(null);
    try {
      const name = chipName || getDefaultChipName();
      const id = await client.createChipFromChip(
        selectedChipIds,
        query || undefined,
        tableName || undefined,
        name,
      );
      setChipId(id);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create chip");
      setStep("confirm");
    }
  };

  const allChips = chipsData?.chips ?? [];
  const metadata = chipsData?.metadata ?? [];
  const showSubChips = hasAnySubChips(allChips);

  // Unique main chip IDs (chip_id === sub_chip_id)
  const mainChipIds = [...new Set(
    allChips.filter((c: Chip) => c.chip_id === c.sub_chip_id).map((c: Chip) => c.chip_id),
  )];

  const cols = chipColumns(termCols, 4, showSubChips);

  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color={brand.cyan} bold>
        Create Chip from Chip
      </Text>

      {step === "select-chips" && (
        <Box flexDirection="column" gap={1}>
          {chipsLoading && <Spinner label="Loading chips..." />}
          {chipsError && <Text color={brand.error}>{chipsError}</Text>}
          {!chipsLoading && !chipsError && mainChipIds.length === 0 && (
            <Text color={brand.muted}>No chips found. Create a chip first.</Text>
          )}
          {!chipsLoading && !chipsError && mainChipIds.length > 0 && (
            <>
              <Text color={brand.text}>Select source chip(s):</Text>
              <Text color={brand.muted} dimColor>
                {chipHeader(cols)}
              </Text>
              <MultiSelect
                options={mainChipIds.map((id) => {
                  const meta = metadata.find((m: ChipMetadata) => m.chip_id === id);
                  return {
                    label: chipLabel(id, meta, allChips, cols),
                    value: id,
                  };
                })}
                onSubmit={(values) => {
                  if (values.length > 0) {
                    setSelectedChipIds(values);
                    setStep("query");
                  }
                }}
              />
            </>
          )}
        </Box>
      )}

      {step === "query" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.muted}>
            Source chips: {selectedChipIds.length} selected
          </Text>
          <Text color={brand.text}>
            SQL query (Enter to copy all data):
          </Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="SELECT * FROM table_name WHERE ..."
              onSubmit={(v) => {
                setQuery(v.trim());
                setStep("table-name");
              }}
            />
          </Box>
          <Text color={brand.muted} dimColor>
            Query runs against the source chip tables. Leave empty to copy all data.
          </Text>
        </Box>
      )}

      {step === "table-name" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Table name (Enter for default):</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="data"
              onSubmit={(v) => {
                setTableName(v.trim());
                setStep("chip-name");
              }}
            />
          </Box>
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
                setStep("confirm");
              }}
            />
          </Box>
        </Box>
      )}

      {step === "confirm" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.cyan} bold>─── Confirm Settings ───</Text>
          <Box flexDirection="column" paddingLeft={1}>
            <Text>
              <Text color={brand.muted}>Name          </Text>
              <Text color={brand.text}>{chipName || getDefaultChipName()}</Text>
            </Text>
            <Text>
              <Text color={brand.muted}>Source Type   </Text>
              <Text color={brand.text}>Chip (CACHE)</Text>
            </Text>
            <Text>
              <Text color={brand.muted}>Source Chips  </Text>
              <Text color={brand.text}>{selectedChipIds.length} chip{selectedChipIds.length !== 1 ? "s" : ""}</Text>
            </Text>
            {selectedChipIds.map((id) => {
              const meta = metadata.find((m: ChipMetadata) => m.chip_id === id);
              return (
                <Text key={id}>
                  <Text color={brand.muted}>              </Text>
                  <Text color={brand.violet}>{meta?.name ?? id.slice(0, 12)}</Text>
                  <Text color={brand.muted}> ({id.slice(0, 8)}…)</Text>
                </Text>
              );
            })}
            <Text>
              <Text color={brand.muted}>Query         </Text>
              <Text color={brand.text}>{query || "(copy all data)"}</Text>
            </Text>
            <Text>
              <Text color={brand.muted}>Table Name    </Text>
              <Text color={brand.text}>{tableName || "data"}</Text>
            </Text>
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
                  setStep("query");
                }
              }}
            />
          </Box>
          {error && <Text color={brand.error}>{error}</Text>}
        </Box>
      )}

      {step === "creating" && <Spinner label="Creating chip from source chips..." />}

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
