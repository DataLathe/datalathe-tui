import { join } from "node:path";
import { homedir } from "node:os";

export const baseDir = join(homedir(), ".datalathe");
export const binDir = join(baseDir, "bin");
export const configDir = join(baseDir, "config");
export const logsDir = join(baseDir, "logs");
export const runDir = join(baseDir, "run");
export const manifestPath = join(binDir, ".manifest.json");
export const licensePath = join(configDir, "license.json");
export const engineConfigPath = join(configDir, "engine.conf.json");
export const chipConfigPath = join(configDir, "chip.conf.json");
export const engineBinPath = join(binDir, "engine");
export const chipManagerBinPath = join(binDir, "chip-manager");
