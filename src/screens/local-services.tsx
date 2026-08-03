import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { Spinner } from "@inkjs/ui";
import { brand } from "../theme.js";
import {
  serviceStatus,
  startServices,
  stopServices,
  type ServiceStatus,
  type StartResult,
  type StopResult,
} from "../utils/local-services.js";

type Phase = "loading" | "idle" | "starting" | "stopping";

interface LocalServicesScreenProps {
  onDownload: () => void;
  isFocused: boolean;
}

export function LocalServicesScreen({
  onDownload,
  isFocused,
}: LocalServicesScreenProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [statuses, setStatuses] = useState<ServiceStatus[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [startResults, setStartResults] = useState<StartResult[]>([]);
  const [stopResults, setStopResults] = useState<StopResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      setStatuses(await serviceStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read service status");
    }
    setPhase("idle");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleStart = async () => {
    setPhase("starting");
    setError(null);
    setStopResults([]);
    setStartResults([]);
    try {
      setStartResults(await startServices(setProgress));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start services");
    }
    setProgress(null);
    setStatuses(await serviceStatus());
    setPhase("idle");
  };

  const handleStop = async () => {
    setPhase("stopping");
    setError(null);
    setStartResults([]);
    setStopResults([]);
    try {
      setStopResults(await stopServices());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop services");
    }
    setStatuses(await serviceStatus());
    setPhase("idle");
  };

  const anyInstalled = statuses.some((s) => s.installed);
  const allInstalled = statuses.length > 0 && statuses.every((s) => s.installed);

  useInput(
    (input) => {
      if (phase !== "idle") return;
      if (input === "s" && anyInstalled) handleStart();
      else if (input === "t") handleStop();
      else if (input === "r") refresh();
      else if (input === "d" && !allInstalled) onDownload();
    },
    { isActive: isFocused },
  );

  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color={brand.cyan} bold>
        Local Services
      </Text>

      {phase === "loading" && <Spinner label="Checking services..." />}
      {phase === "starting" && <Spinner label={progress ?? "Starting services..."} />}
      {phase === "stopping" && <Spinner label="Stopping services..." />}

      {phase === "idle" && (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="column">
            {statuses.map((s) => (
              <Box key={s.name} flexDirection="column" marginBottom={1}>
                <Box>
                  <Text color={brand.text} bold>
                    {s.name.padEnd(14)}
                  </Text>
                  {!s.installed ? (
                    <Text color={brand.error}>not installed</Text>
                  ) : (
                    <>
                      <Text color={brand.success}>installed</Text>
                      <Text color={brand.muted}>  </Text>
                      {s.pid !== null ? (
                        <Text color={brand.success}>running (pid {s.pid})</Text>
                      ) : (
                        <Text color={brand.muted}>not running</Text>
                      )}
                      <Text color={brand.muted}>  </Text>
                      {s.reachable ? (
                        <Text color={brand.cyan}>reachable</Text>
                      ) : (
                        <Text color={brand.muted}>unreachable</Text>
                      )}
                    </>
                  )}
                </Box>
                {s.installed && !s.hasConfig && (
                  <Text color={brand.error}>  config missing — re-run Download Binaries with config generation</Text>
                )}
                <Text color={brand.muted} dimColor>
                  {"  "}log: {s.logFile}
                </Text>
              </Box>
            ))}
          </Box>

          {!allInstalled && (
            <Text color={brand.muted}>
              Binaries missing — press d to open Download Binaries.
            </Text>
          )}

          {startResults.length > 0 && (
            <Box flexDirection="column">
              {startResults.map((r) => (
                <Box key={r.name} flexDirection="column">
                  <Text color={r.ok ? brand.success : brand.error}>
                    {r.name}: {r.message}
                  </Text>
                  {!r.ok &&
                    r.logTail.map((line, i) => (
                      <Text key={i} color={brand.muted} dimColor>
                        {"  "}{line}
                      </Text>
                    ))}
                </Box>
              ))}
            </Box>
          )}

          {stopResults.length > 0 && (
            <Box flexDirection="column">
              {stopResults.map((r) => (
                <Text key={r.name} color={r.ok ? brand.success : brand.error}>
                  {r.name}: {r.message}
                </Text>
              ))}
            </Box>
          )}

          {error && <Text color={brand.error}>{error}</Text>}

          <Box gap={2} flexWrap="wrap">
            {anyInstalled && <Text color={brand.muted}>s:start all</Text>}
            <Text color={brand.muted}>t:stop all</Text>
            <Text color={brand.muted}>r:refresh</Text>
            {!allInstalled && <Text color={brand.muted}>d:download binaries</Text>}
            <Text color={brand.muted}>b:back</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
