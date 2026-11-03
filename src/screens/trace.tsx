import React, { useState, useMemo, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput, Spinner } from "@inkjs/ui";
import type { Chip, ChipMetadata, ChipsResponse, IngestJob } from "@datalathe/client";
import { useClient } from "../hooks/use-client.js";
import { useTerminalSize } from "../hooks/use-terminal-size.js";
import { ErrorDisplay } from "../components/error-display.js";
import { ChipRow } from "../components/chip-row.js";
import { brand } from "../theme.js";
import { buildChipIndex } from "../utils/chip-options.js";
import { jobsForCorrelation, jobProgress, jobWhen } from "../utils/trace.js";

type Step = "input" | "loading" | "error" | "results";

interface TraceScreenProps {
  initialCorrelationId?: string;
  onSelectChip: (chipId: string) => void;
  onQuery: (chipIds: string[]) => void;
  onRawQuery: (chipIds: string[]) => void;
  onBack: () => void;
  onInputActive?: (active: boolean) => void;
  isFocused: boolean;
}

function statusColor(status: IngestJob["status"]): string {
  switch (status) {
    case "succeeded":
      return brand.success;
    case "failed":
      return brand.error;
    case "running":
      return brand.cyan;
    default:
      return brand.muted;
  }
}

// one correlation id, everything the engine did for it: the ingest jobs it started and the chips it created
export function TraceScreen({
  initialCorrelationId,
  onSelectChip,
  onQuery,
  onRawQuery,
  onBack,
  onInputActive,
  isFocused,
}: TraceScreenProps) {
  const client = useClient();
  const { rows } = useTerminalSize();

  const [correlationId, setCorrelationId] = useState(initialCorrelationId ?? "");
  const [step, setStep] = useState<Step>(initialCorrelationId ? "loading" : "input");
  const [error, setError] = useState<string | null>(null);
  const [chips, setChips] = useState<ChipsResponse | null>(null);
  const [jobs, setJobs] = useState<IngestJob[]>([]);
  const [jobsNote, setJobsNote] = useState<string | null>(null);

  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [expandedChipId, setExpandedChipId] = useState<string | null>(null);

  useEffect(() => {
    onInputActive?.(step === "input");
    return () => onInputActive?.(false);
  }, [step, onInputActive]);

  const load = async (id: string) => {
    setStep("loading");
    setError(null);
    setJobsNote(null);
    try {
      const chipResult = await client.chips.search(undefined, undefined, undefined, id);
      let runJobs: IngestJob[] = [];
      try {
        runJobs = jobsForCorrelation(await client.chips.listIngestJobs(), id);
      } catch (err) {
        setJobsNote(err instanceof Error ? err.message : "Jobs unavailable");
      }
      setChips(chipResult);
      setJobs(runJobs);
      setCursor(0);
      setScrollOffset(0);
      setExpandedChipId(null);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trace failed");
      setStep("error");
    }
  };

  useEffect(() => {
    if (initialCorrelationId) void load(initialCorrelationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCorrelationId]);

  const { mainChipIds, metaMap, index } = useMemo(() => {
    const allChips = chips?.chips ?? [];
    const allTags = chips?.tags ?? [];
    const metaMap = new Map<string, ChipMetadata>();
    for (const m of chips?.metadata ?? []) metaMap.set(m.chipId, m);
    const idx = buildChipIndex(allChips, allTags);
    const mainChipIds = [...new Set(allChips.map((c: Chip) => c.chipId))];
    return { mainChipIds, metaMap, index: idx };
  }, [chips]);

  const maxVisible = Math.max(3, rows - 12 - Math.min(jobs.length, 6));

  useInput(
    (input, key) => {
      if (!isFocused) return;
      if (step === "error") {
        if (input === "r") void load(correlationId);
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
          if (next >= scrollOffset + maxVisible) setScrollOffset(next - maxVisible + 1);
          return next;
        });
      } else if (key.return) {
        const chipId = mainChipIds[cursor];
        if (chipId) setExpandedChipId((prev) => (prev === chipId ? null : chipId));
      } else if (input === "v") {
        const chipId = mainChipIds[cursor];
        if (chipId) onSelectChip(chipId);
      } else if (input === "s") {
        const chipId = mainChipIds[cursor];
        if (chipId) onQuery([chipId]);
      } else if (input === "x") {
        const chipId = mainChipIds[cursor];
        if (chipId) onRawQuery([chipId]);
      } else if (input === "a" && mainChipIds.length > 0) {
        onQuery(mainChipIds);
      } else if (input === "n") {
        setChips(null);
        setJobs([]);
        setStep("input");
      } else if (input === "r") {
        void load(correlationId);
      }
    },
    { isActive: isFocused && (step === "results" || step === "error") },
  );

  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color={brand.cyan} bold>
        Trace Run
      </Text>

      {step === "input" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Correlation ID (the X-Correlation-ID a request carried):</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="6f1c0a2e-..."
              defaultValue={correlationId}
              onSubmit={(v) => {
                const id = v.trim();
                if (!id) {
                  onBack();
                  return;
                }
                setCorrelationId(id);
                void load(id);
              }}
            />
          </Box>
          <Text color={brand.muted}>Empty input goes back.</Text>
        </Box>
      )}

      {step === "loading" && <Spinner label="Tracing..." />}

      {step === "error" && error && (
        <ErrorDisplay message={error} onRetry={() => void load(correlationId)} onBack={onBack} />
      )}

      {step === "results" && (
        <Box flexDirection="column" gap={1}>
          <Text>
            <Text color={brand.muted}>correlation=</Text>
            <Text color={brand.text}>{correlationId}</Text>
          </Text>

          <Box flexDirection="column">
            <Text color={brand.cyan} bold>
              Ingest jobs ({jobs.length})
            </Text>
            {jobsNote && <Text color={brand.muted}>Jobs unavailable: {jobsNote}</Text>}
            {!jobsNote && jobs.length === 0 && (
              <Text color={brand.muted}>No ingest jobs carry this ID.</Text>
            )}
            {jobs.slice(0, 6).map((job) => (
              <Box key={job.jobId} flexDirection="column">
                <Text>
                  <Text color={statusColor(job.status)}>{job.status.padEnd(9)}</Text>
                  <Text color={brand.text}>{job.jobId.slice(0, 8)}</Text>
                  <Text color={brand.muted}>  chip </Text>
                  <Text color={brand.violet}>{job.chipId ? job.chipId.slice(0, 8) : "-"}</Text>
                  {jobProgress(job) && <Text color={brand.muted}>  {jobProgress(job)}</Text>}
                  {jobWhen(job) && <Text color={brand.muted}>  {jobWhen(job)}</Text>}
                </Text>
                {job.error && (
                  <Text color={brand.error}>{"          " + job.error.slice(0, 120)}</Text>
                )}
              </Box>
            ))}
            {jobs.length > 6 && (
              <Text color={brand.muted}>  and {jobs.length - 6} more</Text>
            )}
          </Box>

          <Box flexDirection="column">
            <Text color={brand.cyan} bold>
              Chips ({mainChipIds.length})
            </Text>
            {mainChipIds.length === 0 ? (
              <Text color={brand.muted}>No chips carry this ID.</Text>
            ) : (
              mainChipIds.slice(scrollOffset, scrollOffset + maxVisible).map((chipId, i) => (
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
                {Math.min(scrollOffset + maxVisible, mainChipIds.length)}/{mainChipIds.length}{" "}
                {scrollOffset + maxVisible < mainChipIds.length ? "↓" : " "}
              </Text>
            )}
          </Box>

          <Box gap={2} flexWrap="wrap">
            {mainChipIds.length > 0 && (
              <>
                <Text color={brand.muted}>enter:expand</Text>
                <Text color={brand.muted}>v:full detail</Text>
                <Text color={brand.muted}>s:query</Text>
                <Text color={brand.muted}>x:raw sql</Text>
                <Text color={brand.muted}>a:query all</Text>
              </>
            )}
            <Text color={brand.muted}>r:refresh</Text>
            <Text color={brand.muted}>n:new id</Text>
            <Text color={brand.muted}>b:back</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
