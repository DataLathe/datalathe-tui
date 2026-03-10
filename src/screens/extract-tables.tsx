import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput, Spinner, Select } from "@inkjs/ui";
import { useClient } from "../hooks/use-client.js";
import { brand } from "../theme.js";

type Step = "transform-option" | "sql" | "extracting" | "results";

interface ExtractTablesScreenProps {
  onBack: () => void;
  onInputActive?: (active: boolean) => void;
  isFocused: boolean;
}

export function ExtractTablesScreen({ onBack, onInputActive, isFocused }: ExtractTablesScreenProps) {
  const client = useClient();
  const [step, setStep] = useState<Step>("transform-option");
  const [transform, setTransform] = useState(false);
  const [query, setQuery] = useState("");
  const [tables, setTables] = useState<string[]>([]);
  const [transformedQuery, setTransformedQuery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onInputActive?.(step === "sql");
    return () => onInputActive?.(false);
  }, [step, onInputActive]);

  const handleExtract = async (rawQuery: string) => {
    if (!rawQuery.trim()) return;
    setQuery(rawQuery);
    setStep("extracting");
    setError(null);

    try {
      const result = await client.extractTablesWithTransform(rawQuery, transform || undefined);
      setTables(result.tables);
      setTransformedQuery(result.transformed_query);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
      setStep("sql");
    }
  };

  useInput(
    (input) => {
      if (step !== "results") return;
      if (input === "r") {
        setTables([]);
        setTransformedQuery(null);
        setError(null);
        setStep("sql");
      }
      if (input === "t") {
        setTables([]);
        setTransformedQuery(null);
        setError(null);
        setTransform(false);
        setStep("transform-option");
      }
    },
    { isActive: isFocused },
  );

  if (step === "transform-option") {
    return (
      <Box flexDirection="column" gap={1} paddingY={1}>
        <Text color={brand.cyan} bold>
          Extract Tables
        </Text>
        <Text color={brand.muted}>
          Transform MySQL/MariaDB syntax to DuckDB before extracting?
        </Text>
        <Select
          options={[
            { label: "No — parse query as-is", value: "no" },
            { label: "Yes — transform MySQL/MariaDB → DuckDB", value: "yes" },
          ]}
          onChange={(value) => {
            setTransform(value === "yes");
            setStep("sql");
          }}
        />
      </Box>
    );
  }

  if (step === "sql") {
    return (
      <Box flexDirection="column" gap={1} paddingY={1}>
        <Text color={brand.cyan} bold>
          Extract Tables
        </Text>
        <Box flexDirection="column" gap={1}>
          <Box gap={1}>
            <Text color={brand.text}>Enter SQL to analyze:</Text>
            {transform && <Text color={brand.violet}>[transform: on]</Text>}
          </Box>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="SELECT * FROM ..."
              onSubmit={handleExtract}
            />
          </Box>
        </Box>
        {error && <Text color={brand.error}>{error}</Text>}
      </Box>
    );
  }

  if (step === "extracting") {
    return <Spinner label="Extracting tables..." />;
  }

  // results step
  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color={brand.success} bold>
        Extract Tables — Results
      </Text>

      <Box flexDirection="column">
        <Text color={brand.cyan} bold>Original Query</Text>
        <Text color={brand.muted}>  {query}</Text>
      </Box>

      {transformedQuery && (
        <Box flexDirection="column">
          <Text color={brand.violet} bold>Transformed Query</Text>
          <Text color={brand.muted}>  {transformedQuery}</Text>
        </Box>
      )}

      <Box flexDirection="column">
        <Text color={brand.cyan} bold>
          Tables ({tables.length})
        </Text>
        {tables.length > 0 ? (
          tables.map((table) => (
            <Text key={table} color={brand.text}>
              {"  "}<Text color={brand.violet}>•</Text> {table}
            </Text>
          ))
        ) : (
          <Text color={brand.muted}>  No tables found in query</Text>
        )}
      </Box>

      <Text color={brand.muted}>r:new query  t:change transform  b:back</Text>
    </Box>
  );
}
