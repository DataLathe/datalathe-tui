import React, { useState, useMemo, useEffect, useCallback } from "react";
import { execSync } from "node:child_process";
import { Box, Text, useInput } from "ink";
import { TextInput, Spinner } from "@inkjs/ui";
import type { SeriesSummary, SeriesSlotsResponse } from "@datalathe/client";
import { useClient } from "../hooks/use-client.js";
import { useTerminalSize } from "../hooks/use-terminal-size.js";
import { ErrorDisplay } from "../components/error-display.js";
import { brand } from "../theme.js";
import { seriesRows, rowReference, seriesReference, publishedWhen } from "../utils/series.js";

type Step = "loading" | "error" | "list" | "filter" | "slots";

interface BrowseSeriesScreenProps {
  onSelectChip: (chipId: string) => void;
  onQuery: (references: string[]) => void;
  onBack: () => void;
  onInputActive?: (active: boolean) => void;
  isFocused: boolean;
}

const PAGE_SIZE = 200;

export function BrowseSeriesScreen({
  onSelectChip,
  onQuery,
  onBack,
  onInputActive,
  isFocused,
}: BrowseSeriesScreenProps) {
  const client = useClient();
  const { rows: termRows } = useTerminalSize();

  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(null);
  const [prefix, setPrefix] = useState("");
  const [series, setSeries] = useState<SeriesSummary[]>([]);
  const [more, setMore] = useState(false);
  const [view, setView] = useState<SeriesSlotsResponse | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    onInputActive?.(step === "filter");
    return () => onInputActive?.(false);
  }, [step, onInputActive]);

  const resetCursor = () => {
    setCursor(0);
    setScrollOffset(0);
  };

  const loadList = useCallback(
    async (withPrefix: string) => {
      setStep("loading");
      setError(null);
      try {
        const page = await client.series.list({
          prefix: withPrefix || undefined,
          limit: PAGE_SIZE,
        });
        setSeries(page.series);
        setMore(page.nextCursor !== undefined);
        setView(null);
        resetCursor();
        setStep("list");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not list series");
        setStep("error");
      }
    },
    [client],
  );

  const loadSlots = useCallback(
    async (seriesId: string) => {
      setStep("loading");
      setError(null);
      try {
        setView(await client.series.slots(seriesId));
        setExpanded(new Set());
        resetCursor();
        setStep("slots");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read the series");
        setStep("error");
      }
    },
    [client],
  );

  useEffect(() => {
    void loadList("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => (view ? seriesRows(view, expanded) : []), [view, expanded]);
  const count = step === "slots" ? rows.length : series.length;
  const maxVisible = Math.max(3, termRows - 12);

  const copy = (reference: string) => {
    try {
      execSync("pbcopy", { input: reference });
      setCopied(reference);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  useInput(
    (input, key) => {
      if (!isFocused) return;
      if (step === "error") {
        if (input === "r") void (view ? loadSlots(view.seriesId) : loadList(prefix));
        return;
      }

      if (key.upArrow) {
        setCursor((c) => {
          const next = Math.max(0, c - 1);
          if (next < scrollOffset) setScrollOffset(next);
          return next;
        });
        return;
      }
      if (key.downArrow) {
        setCursor((c) => {
          const next = Math.min(count - 1, c + 1);
          if (next >= scrollOffset + maxVisible) setScrollOffset(next - maxVisible + 1);
          return next;
        });
        return;
      }

      if (step === "list") {
        const selected = series[cursor];
        if (key.return && selected) void loadSlots(selected.seriesId);
        else if (input === "a" && selected) onQuery([seriesReference(selected.seriesId)]);
        else if (input === "c" && selected) copy(seriesReference(selected.seriesId));
        else if (input === "/") setStep("filter");
        else if (input === "r") void loadList(prefix);
        return;
      }

      if (step === "slots" && view) {
        const row = rows[cursor];
        if (key.escape || key.leftArrow) {
          void loadList(prefix);
        } else if (key.return && row) {
          const table = row.tableName;
          setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(table)) next.delete(table);
            else next.add(table);
            return next;
          });
        } else if (input === "s" && row) {
          onQuery([rowReference(view.seriesId, row)]);
        } else if (input === "a") {
          onQuery([seriesReference(view.seriesId)]);
        } else if (input === "c") {
          copy(row ? rowReference(view.seriesId, row) : seriesReference(view.seriesId));
        } else if (input === "v" && row?.kind === "slot") {
          onSelectChip(row.chipId);
        } else if (input === "r") {
          void loadSlots(view.seriesId);
        }
      }
    },
    { isActive: isFocused && step !== "filter" && step !== "loading" },
  );

  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color={brand.cyan} bold>
        Browse Series
      </Text>

      {step === "loading" && <Spinner label="Loading..." />}

      {step === "error" && error && (
        <ErrorDisplay
          message={error}
          onRetry={() => void (view ? loadSlots(view.seriesId) : loadList(prefix))}
          onBack={onBack}
        />
      )}

      {step === "filter" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Series ID starts with:</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="1234"
              defaultValue={prefix}
              onSubmit={(value) => {
                const next = value.trim();
                setPrefix(next);
                void loadList(next);
              }}
            />
          </Box>
          <Text color={brand.muted}>Empty input lists every series.</Text>
        </Box>
      )}

      {step === "list" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.muted}>
            {series.length} series{prefix ? ` starting with "${prefix}"` : ""}
            {more ? ` (first ${PAGE_SIZE}; narrow with /)` : ""}
          </Text>
          {series.length === 0 && (
            <Text color={brand.muted}>
              No series. A chip joins one when its create request names a series.
            </Text>
          )}
          <Box flexDirection="column">
            {series.slice(scrollOffset, scrollOffset + maxVisible).map((s, i) => {
              const active = scrollOffset + i === cursor;
              return (
                <Text key={s.seriesId}>
                  <Text color={active ? brand.violet : brand.muted}>{active ? "❯ " : "  "}</Text>
                  <Text color={brand.text} bold={active}>
                    {s.seriesId.padEnd(28)}
                  </Text>
                  <Text color={brand.muted}>
                    {String(s.tables).padStart(3)} tables {String(s.liveSlotEntries).padStart(5)} slots
                  </Text>
                  <Text color={brand.muted}>  {publishedWhen(s.lastPublishedAt)}</Text>
                </Text>
              );
            })}
          </Box>
          <Text color={brand.muted}>
            ↑↓:move  enter:open  a:query all  c:copy reference  /:filter  r:reload  b:back
          </Text>
        </Box>
      )}

      {step === "slots" && view && (
        <Box flexDirection="column" gap={1}>
          <Text>
            <Text color={brand.muted}>series=</Text>
            <Text color={brand.text}>{view.seriesId}</Text>
            <Text color={brand.muted}>  view=</Text>
            <Text color={brand.text}>{view.asOf}</Text>
          </Text>
          {rows.length === 0 && <Text color={brand.muted}>This series has no current chips.</Text>}
          <Box flexDirection="column">
            {rows.slice(scrollOffset, scrollOffset + maxVisible).map((row, i) => {
              const active = scrollOffset + i === cursor;
              const marker = <Text color={active ? brand.violet : brand.muted}>{active ? "❯ " : "  "}</Text>;
              if (row.kind === "table") {
                return (
                  <Text key={`t:${row.tableName}`}>
                    {marker}
                    <Text color={brand.cyan} bold={active}>
                      {expanded.has(row.tableName) ? "▾ " : "▸ "}
                      {row.tableName.padEnd(26)}
                    </Text>
                    <Text color={brand.muted}>
                      {String(row.slotCount).padStart(4)} slots {String(row.columnCount).padStart(3)} columns  major{" "}
                      {row.contractMajor}
                    </Text>
                  </Text>
                );
              }
              return (
                <Text key={`s:${row.tableName}:${row.partitionValue}`}>
                  {marker}
                  <Text color={brand.text}>
                    {"    "}
                    {(row.partitionValue || "(unpartitioned)").padEnd(24)}
                  </Text>
                  <Text color={brand.muted}>v{String(row.version).padEnd(5)}</Text>
                  <Text color={brand.violet}>{row.chipId}</Text>
                </Text>
              );
            })}
          </Box>
          {copied && <Text color={brand.success}>Copied {copied}</Text>}
          <Text color={brand.muted}>
            ↑↓:move  enter:expand  s:query row  a:query all  c:copy reference  v:view chip  r:reload  ←:series list
          </Text>
        </Box>
      )}
    </Box>
  );
}
