import React, { useState, useMemo, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput, Spinner } from "@inkjs/ui";
import type { Chip, ChipMetadata, ChipsResponse } from "@datalathe/client";
import { useClient } from "../hooks/use-client.js";
import { useTerminalSize } from "../hooks/use-terminal-size.js";
import { ErrorDisplay } from "../components/error-display.js";
import { MenuSelect } from "../components/menu-select.js";
import { ChipRow } from "../components/chip-row.js";
import { brand } from "../theme.js";
import { buildChipIndex } from "../utils/chip-options.js";

type Step =
  | "table"
  | "partition"
  | "tag-key"
  | "tag-value"
  | "confirm"
  | "searching"
  | "error"
  | "results";

const INPUT_STEPS: Step[] = ["table", "partition", "tag-key", "tag-value"];

interface SearchChipsScreenProps {
  onSelectChip: (chipId: string) => void;
  onQuery: (chipIds: string[]) => void;
  onRawQuery: (chipIds: string[]) => void;
  onCreateFromChip: (chipIds: string[]) => void;
  onBack: () => void;
  onInputActive?: (active: boolean) => void;
  isFocused: boolean;
}

export function SearchChipsScreen({
  onSelectChip,
  onQuery,
  onRawQuery,
  onCreateFromChip,
  onBack,
  onInputActive,
  isFocused,
}: SearchChipsScreenProps) {
  const client = useClient();
  const { rows } = useTerminalSize();

  const [step, setStep] = useState<Step>("table");
  const [tableName, setTableName] = useState("");
  const [partitionValue, setPartitionValue] = useState("");
  const [tagKey, setTagKey] = useState("");
  const [tagValue, setTagValue] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ChipsResponse | null>(null);

  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [expandedChipId, setExpandedChipId] = useState<string | null>(null);

  useEffect(() => {
    onInputActive?.(INPUT_STEPS.includes(step));
    return () => onInputActive?.(false);
  }, [step, onInputActive]);

  const validate = (): string | null => {
    if (!tableName && !partitionValue && !tagKey && !tagValue) {
      return "Enter at least one search field.";
    }
    if ((tagKey && !tagValue) || (!tagKey && tagValue)) {
      return "Tag key and tag value must be provided together.";
    }
    return null;
  };

  const handleSearch = async () => {
    setStep("searching");
    setError(null);
    try {
      const tag = tagKey ? `${tagKey}=${tagValue}` : undefined;
      const res = await client.chips.search(
        tableName || undefined,
        partitionValue || undefined,
        tag,
      );
      setResults(res);
      setCursor(0);
      setScrollOffset(0);
      setExpandedChipId(null);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setStep("error");
    }
  };

  const startNewSearch = () => {
    setResults(null);
    setValidation(null);
    setStep("table");
  };

  const { mainChipIds, metaMap, index } = useMemo(() => {
    const allChips = results?.chips ?? [];
    const allTags = results?.tags ?? [];
    const metadata = results?.metadata ?? [];

    const metaMap = new Map<string, ChipMetadata>();
    for (const m of metadata) metaMap.set(m.chipId, m);

    const idx = buildChipIndex(allChips, allTags);
    const mainChipIds = [...new Set(allChips.map((c: Chip) => c.chipId))];

    return { mainChipIds, metaMap, index: idx };
  }, [results]);

  const maxVisible = Math.max(3, rows - 9);

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (step === "error") {
        if (input === "r") handleSearch();
        return;
      }
      if (step !== "results") return;

      if (key.upArrow) {
        setCursor((c) => {
          const next = Math.max(0, c - 1);
          if (next < scrollOffset) setScrollOffset(next);
          return next;
        });
      } else if (key.downArrow) {
        setCursor((c) => {
          const next = Math.min(mainChipIds.length - 1, c + 1);
          if (next >= scrollOffset + maxVisible)
            setScrollOffset(next - maxVisible + 1);
          return next;
        });
      } else if (key.return) {
        const chipId = mainChipIds[cursor];
        if (chipId) {
          setExpandedChipId((prev) => (prev === chipId ? null : chipId));
        }
      } else if (input === "v") {
        const chipId = mainChipIds[cursor];
        if (chipId) onSelectChip(chipId);
      } else if (input === "s") {
        const chipId = mainChipIds[cursor];
        if (chipId) onQuery([chipId]);
      } else if (input === "x") {
        const chipId = mainChipIds[cursor];
        if (chipId) onRawQuery([chipId]);
      } else if (input === "c") {
        const chipId = mainChipIds[cursor];
        if (chipId) onCreateFromChip([chipId]);
      } else if (input === "n") {
        startNewSearch();
      }
    },
    { isActive: isFocused && (step === "results" || step === "error") },
  );

  const criteriaSummary = [
    tableName && `table=${tableName}`,
    partitionValue && `partition=${partitionValue}`,
    tagKey && `tag=${tagKey}=${tagValue}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color={brand.cyan} bold>
        Search Chips
      </Text>

      {step === "table" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Table name (Enter to skip):</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="my_table"
              defaultValue={tableName}
              onSubmit={(v) => {
                setTableName(v.trim());
                setStep("partition");
              }}
            />
          </Box>
        </Box>
      )}

      {step === "partition" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Partition value (Enter to skip):</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="2026-01"
              defaultValue={partitionValue}
              onSubmit={(v) => {
                setPartitionValue(v.trim());
                setStep("tag-key");
              }}
            />
          </Box>
        </Box>
      )}

      {step === "tag-key" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Tag key (Enter to skip):</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="env"
              defaultValue={tagKey}
              onSubmit={(v) => {
                setTagKey(v.trim());
                setStep("tag-value");
              }}
            />
          </Box>
        </Box>
      )}

      {step === "tag-value" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Tag value (Enter to skip):</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="prod"
              defaultValue={tagValue}
              onSubmit={(v) => {
                setTagValue(v.trim());
                setValidation(null);
                setStep("confirm");
              }}
            />
          </Box>
        </Box>
      )}

      {step === "confirm" && (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="column" paddingLeft={1}>
            <Text>
              <Text color={brand.muted}>Table      </Text>
              <Text color={brand.text}>{tableName || "Any"}</Text>
            </Text>
            <Text>
              <Text color={brand.muted}>Partition  </Text>
              <Text color={brand.text}>{partitionValue || "Any"}</Text>
            </Text>
            <Text>
              <Text color={brand.muted}>Tag        </Text>
              <Text color={brand.text}>
                {tagKey || tagValue ? `${tagKey}=${tagValue}` : "Any"}
              </Text>
            </Text>
          </Box>
          {validation && <Text color={brand.error}>{validation}</Text>}
          <MenuSelect
            isDisabled={!isFocused}
            options={[
              { label: "Search", value: "search" },
              { label: "Edit Criteria", value: "edit" },
              { label: "Back", value: "back" },
            ]}
            onChange={(value) => {
              if (value === "search") {
                const problem = validate();
                if (problem) {
                  setValidation(problem);
                } else {
                  setValidation(null);
                  handleSearch();
                }
              } else if (value === "edit") {
                setValidation(null);
                setStep("table");
              } else {
                onBack();
              }
            }}
          />
        </Box>
      )}

      {step === "searching" && <Spinner label="Searching chips..." />}

      {step === "error" && error && (
        <ErrorDisplay message={error} onRetry={handleSearch} onBack={onBack} />
      )}

      {step === "results" && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={brand.muted}>
              {mainChipIds.length} chip{mainChipIds.length !== 1 ? "s" : ""} · {criteriaSummary}
            </Text>
          </Box>

          {mainChipIds.length === 0 ? (
            <Text color={brand.muted}>No chips match your search.</Text>
          ) : (
            mainChipIds
              .slice(scrollOffset, scrollOffset + maxVisible)
              .map((chipId, i) => (
                <ChipRow
                  key={chipId}
                  chipId={chipId}
                  meta={metaMap.get(chipId)}
                  index={index}
                  isCursor={scrollOffset + i === cursor}
                  isExpanded={expandedChipId === chipId}
                />
              ))
          )}

          {mainChipIds.length > maxVisible && (
            <Text color={brand.muted}>
              {" "}
              {scrollOffset > 0 ? "↑" : " "} {scrollOffset + 1}-
              {Math.min(scrollOffset + maxVisible, mainChipIds.length)}/
              {mainChipIds.length}{" "}
              {scrollOffset + maxVisible < mainChipIds.length ? "↓" : " "}
            </Text>
          )}

          <Box marginTop={1} gap={2} flexWrap="wrap">
            {mainChipIds.length > 0 && (
              <>
                <Text color={brand.muted}>enter:expand</Text>
                <Text color={brand.muted}>v:full detail</Text>
                <Text color={brand.muted}>s:query</Text>
                <Text color={brand.muted}>x:raw sql</Text>
                <Text color={brand.muted}>c:create from chip</Text>
              </>
            )}
            <Text color={brand.muted}>n:new search</Text>
            <Text color={brand.muted}>b:back</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
