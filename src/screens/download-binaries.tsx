import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput, Spinner, Select } from "@inkjs/ui";
import { brand } from "../theme.js";
import {
  fetchVersions,
  fetchDownloadUrls,
  type VersionsResponse,
} from "../utils/license-api.js";
import {
  downloadBinary,
  formatBytes,
  type DownloadProgress,
} from "../utils/download.js";
import { join } from "node:path";
import { homedir } from "node:os";

type Step =
  | "license-key"
  | "loading-versions"
  | "select-version"
  | "select-platform"
  | "select-directory"
  | "confirm"
  | "downloading"
  | "done"
  | "error";

const INPUT_ACTIVE_STEPS: Step[] = ["license-key", "select-directory"];

const DEFAULT_DIR = join(homedir(), ".datalathe", "bin");

function detectPlatform(): string {
  if (process.platform === "darwin" && process.arch === "arm64")
    return "darwin-arm64";
  if (process.platform === "linux" && process.arch === "x64")
    return "linux-x86_64";
  return `${process.platform}-${process.arch}`;
}

interface DownloadBinariesScreenProps {
  onBack: () => void;
  onInputActive?: (active: boolean) => void;
}

export function DownloadBinariesScreen({
  onBack,
  onInputActive,
}: DownloadBinariesScreenProps) {
  const [step, setStep] = useState<Step>("license-key");
  const [licenseKey, setLicenseKey] = useState("");
  const [versions, setVersions] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [directory, setDirectory] = useState(DEFAULT_DIR);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedStep, setFailedStep] = useState<Step>("license-key");

  useEffect(() => {
    onInputActive?.(INPUT_ACTIVE_STEPS.includes(step));
    return () => onInputActive?.(false);
  }, [step, onInputActive]);

  // Handle error state hotkeys
  useInput((input) => {
    if (step === "error") {
      if (input === "r") {
        setError(null);
        setStep(failedStep);
      } else if (input === "b") {
        setError(null);
        // Go back one step from where it failed
        if (failedStep === "loading-versions") setStep("license-key");
        else if (failedStep === "downloading") setStep("confirm");
        else setStep("license-key");
      }
    }
    if (step === "done") {
      if (input === "b") onBack();
    }
  });

  const handleLicenseSubmit = async (value: string) => {
    const key = value.trim();
    if (!key) return;
    setLicenseKey(key);
    setStep("loading-versions");
    try {
      const data = await fetchVersions(key);
      setVersions(data.versions);
      setPlatforms(data.platforms);
      setStep("select-version");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch versions");
      setFailedStep("loading-versions");
      setStep("error");
    }
  };

  const handleConfirmDownload = async () => {
    setStep("downloading");
    setError(null);
    try {
      const { urls } = await fetchDownloadUrls(
        licenseKey,
        selectedVersion,
        selectedPlatform
      );

      const enginePath = join(directory, "engine");
      const chipManagerPath = join(directory, "chip-manager");

      // Download engine
      await downloadBinary(urls.engine, enginePath, "engine", setProgress);

      // Download chip-manager
      await downloadBinary(
        urls.chipManager,
        chipManagerPath,
        "chip-manager",
        setProgress
      );

      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
      setFailedStep("downloading");
      setStep("error");
    }
  };

  const detectedPlatform = detectPlatform();

  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color={brand.cyan} bold>
        Download Binaries
      </Text>

      {step === "license-key" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Enter your license key:</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder="XXXX-XXXX-XXXX-XXXX"
              onSubmit={handleLicenseSubmit}
            />
          </Box>
        </Box>
      )}

      {step === "loading-versions" && (
        <Spinner label="Validating license and fetching versions..." />
      )}

      {step === "select-version" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Select version:</Text>
          <Select
            options={versions.map((v) => ({ label: v, value: v }))}
            onChange={(value) => {
              setSelectedVersion(value);
              setStep("select-platform");
            }}
          />
        </Box>
      )}

      {step === "select-platform" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.muted}>Version: {selectedVersion}</Text>
          <Text color={brand.text}>Select platform:</Text>
          <Select
            options={platforms.map((p) => ({
              label:
                p === detectedPlatform ? `${p} (detected)` : p,
              value: p,
            }))}
            defaultValue={
              platforms.includes(detectedPlatform)
                ? detectedPlatform
                : undefined
            }
            onChange={(value) => {
              setSelectedPlatform(value);
              setStep("select-directory");
            }}
          />
        </Box>
      )}

      {step === "select-directory" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.muted}>
            Version: {selectedVersion} · Platform: {selectedPlatform}
          </Text>
          <Text color={brand.text}>
            Save directory (Enter for default):
          </Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput
              placeholder={DEFAULT_DIR}
              defaultValue={DEFAULT_DIR}
              onSubmit={(v) => {
                const dir = v.trim() || DEFAULT_DIR;
                setDirectory(dir);
                setStep("confirm");
              }}
            />
          </Box>
        </Box>
      )}

      {step === "confirm" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.cyan} bold>
            ─── Confirm Download ───
          </Text>
          <Box flexDirection="column" paddingLeft={1}>
            <Text>
              <Text color={brand.muted}>Version    </Text>
              <Text color={brand.text}>{selectedVersion}</Text>
            </Text>
            <Text>
              <Text color={brand.muted}>Platform   </Text>
              <Text color={brand.text}>{selectedPlatform}</Text>
            </Text>
            <Text>
              <Text color={brand.muted}>Directory  </Text>
              <Text color={brand.text}>{directory}</Text>
            </Text>
            <Text>
              <Text color={brand.muted}>Binaries   </Text>
              <Text color={brand.text}>engine, chip-manager</Text>
            </Text>
          </Box>
          <Box marginTop={1}>
            <Select
              options={[
                { label: "Download", value: "download" },
                { label: "Go Back", value: "back" },
              ]}
              onChange={(value) => {
                if (value === "download") {
                  handleConfirmDownload();
                } else {
                  setStep("select-directory");
                }
              }}
            />
          </Box>
        </Box>
      )}

      {step === "downloading" && (
        <Box flexDirection="column" gap={1}>
          <Spinner
            label={
              progress
                ? `Downloading ${progress.binary}... ${formatBytes(progress.bytesDownloaded)}${progress.totalBytes ? ` / ${formatBytes(progress.totalBytes)}` : ""}`
                : "Starting download..."
            }
          />
        </Box>
      )}

      {step === "done" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.success} bold>
            Download complete!
          </Text>
          <Box flexDirection="column" paddingLeft={1}>
            <Text>
              <Text color={brand.muted}>engine        </Text>
              <Text color={brand.text}>{join(directory, "engine")}</Text>
            </Text>
            <Text>
              <Text color={brand.muted}>chip-manager  </Text>
              <Text color={brand.text}>
                {join(directory, "chip-manager")}
              </Text>
            </Text>
          </Box>
          <Text color={brand.muted} dimColor>
            Press b to go back
          </Text>
        </Box>
      )}

      {step === "error" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.error}>{error}</Text>
          <Text color={brand.muted} dimColor>
            Press r to retry · b to go back
          </Text>
        </Box>
      )}
    </Box>
  );
}
