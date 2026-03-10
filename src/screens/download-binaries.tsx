import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput, Spinner, Select } from "@inkjs/ui";
import { brand } from "../theme.js";
import {
  fetchVersions,
  fetchDownloadUrls,
} from "../utils/license-api.js";
import {
  downloadBinary,
  formatBytes,
  type DownloadProgress,
} from "../utils/download.js";
import { join, dirname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";

type Step =
  | "license-key"
  | "loading-versions"
  | "select-version"
  | "select-platform"
  | "select-directory"
  | "create-license-file"
  | "create-configs"
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

function defaultEngineConfig(baseDir: string, configDir: string): object {
  return {
    setup_config: {
      data_path: join(baseDir, "data"),
      connection_config_dir: join(configDir, "connections"),
      persist_path: join(baseDir, "tmp", "datalathe"),
      chip_dir: join(baseDir, "tmp", "chips"),
      chip_manager_url: "http://localhost:5053/chip",
      license_api_file: join(configDir, "license.json"),
    },
  };
}

function defaultChipConfig(baseDir: string): object {
  return {
    database_file_path: join(baseDir, "tmp", "chip_manager"),
    port: 5053,
  };
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
  const [createLicenseFile, setCreateLicenseFile] = useState(false);
  const [createConfigs, setCreateConfigs] = useState(false);
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

  const configDir = join(dirname(directory), "config");

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

      // Create config files if requested
      if (createLicenseFile || createConfigs) {
        await mkdir(configDir, { recursive: true });
      }

      if (createLicenseFile) {
        const licenseData = JSON.stringify({ licenseKey }, null, 4);
        await writeFile(join(configDir, "license.json"), licenseData + "\n");
      }

      if (createConfigs) {
        const baseDir = dirname(directory);
        const engineConf = JSON.stringify(defaultEngineConfig(baseDir, configDir), null, 4);
        await writeFile(join(configDir, "engine.conf.json"), engineConf + "\n");

        const chipConf = JSON.stringify(defaultChipConfig(baseDir), null, 4);
        await writeFile(join(configDir, "chip.conf.json"), chipConf + "\n");

        // Create connections directory referenced by engine config
        await mkdir(join(configDir, "connections"), { recursive: true });
      }

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
            options={[
              // Put detected platform first so it's focused by default
              ...platforms.filter((p) => p === detectedPlatform),
              ...platforms.filter((p) => p !== detectedPlatform),
            ].map((p) => ({
              label:
                p === detectedPlatform ? `${p} (detected)` : p,
              value: p,
            }))}
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
                setStep("create-license-file");
              }}
            />
          </Box>
        </Box>
      )}

      {step === "create-license-file" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Create license file?</Text>
          <Text color={brand.muted}>
            Saves license key to {join(dirname(directory), "config", "license.json")}
          </Text>
          <Select
            options={[
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ]}
            onChange={(value) => {
              setCreateLicenseFile(value === "yes");
              setStep("create-configs");
            }}
          />
        </Box>
      )}

      {step === "create-configs" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Create default config files?</Text>
          <Text color={brand.muted}>
            Saves engine.conf.json and chip.conf.json to {join(dirname(directory), "config")}/
          </Text>
          <Select
            options={[
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ]}
            onChange={(value) => {
              setCreateConfigs(value === "yes");
              setStep("confirm");
            }}
          />
        </Box>
      )}

      {step === "confirm" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.cyan} bold>
            ─── Confirm Download ───
          </Text>
          <Box flexDirection="column" paddingLeft={1}>
            <Text>
              <Text color={brand.muted}>Version       </Text>
              <Text color={brand.text}>{selectedVersion}</Text>
            </Text>
            <Text>
              <Text color={brand.muted}>Platform      </Text>
              <Text color={brand.text}>{selectedPlatform}</Text>
            </Text>
            <Text>
              <Text color={brand.muted}>Directory     </Text>
              <Text color={brand.text}>{directory}</Text>
            </Text>
            <Text>
              <Text color={brand.muted}>Binaries      </Text>
              <Text color={brand.text}>engine, chip-manager</Text>
            </Text>
            <Text>
              <Text color={brand.muted}>License file  </Text>
              <Text color={brand.text}>{createLicenseFile ? "Yes" : "No"}</Text>
            </Text>
            <Text>
              <Text color={brand.muted}>Config files  </Text>
              <Text color={brand.text}>{createConfigs ? "Yes" : "No"}</Text>
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
            {createLicenseFile && (
              <Text>
                <Text color={brand.muted}>license       </Text>
                <Text color={brand.text}>
                  {join(configDir, "license.json")}
                </Text>
              </Text>
            )}
            {createConfigs && (
              <>
                <Text>
                  <Text color={brand.muted}>engine config </Text>
                  <Text color={brand.text}>
                    {join(configDir, "engine.conf.json")}
                  </Text>
                </Text>
                <Text>
                  <Text color={brand.muted}>chip config   </Text>
                  <Text color={brand.text}>
                    {join(configDir, "chip.conf.json")}
                  </Text>
                </Text>
              </>
            )}
          </Box>
          {createConfigs && (
            <Box flexDirection="column" gap={1} paddingTop={1}>
              <Text color={brand.cyan} bold>
                Run these in two separate terminals:
              </Text>
              <Box flexDirection="column" paddingLeft={1}>
                <Text color={brand.text}>
                  CONFIG_PATH={join(configDir, "chip.conf.json")} {join(directory, "chip-manager")}
                </Text>
                <Text color={brand.text}>
                  CONFIG_PATH={join(configDir, "engine.conf.json")} {join(directory, "engine")}
                </Text>
              </Box>
            </Box>
          )}
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
