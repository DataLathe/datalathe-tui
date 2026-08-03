import { spawn, execFile } from "node:child_process";
import { access, mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  engineBinPath,
  chipManagerBinPath,
  engineConfigPath,
  chipConfigPath,
  logsDir,
  runDir,
} from "./datalathe-paths.js";

const execFileAsync = promisify(execFile);

export type ServiceName = "engine" | "chip-manager";

export interface ServiceDefinition {
  name: ServiceName;
  binPath: string;
  configPath: string;
  healthUrl: string;
  pidFile: string;
  logFile: string;
}

export interface ServiceStatus {
  name: ServiceName;
  installed: boolean;
  hasConfig: boolean;
  pid: number | null;
  reachable: boolean;
  logFile: string;
}

export interface StartResult {
  name: ServiceName;
  ok: boolean;
  pid: number | null;
  message: string;
  logTail: string[];
}

export interface StopResult {
  name: ServiceName;
  ok: boolean;
  message: string;
}

export const DEFAULT_CHIP_MANAGER_PORT = 5053;
export const ENGINE_PORT = 3000;

const READY_TIMEOUT_MS = 20_000;
const READY_POLL_MS = 500;
const STOP_TIMEOUT_MS = 10_000;
const LOG_TAIL_LINES = 8;

export function parsePid(content: string): number | null {
  const pid = Number.parseInt(content.trim(), 10);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

export function commandMatchesBinary(psCommand: string, binPath: string): boolean {
  const cmd = psCommand.trim();
  return cmd === binPath || cmd.startsWith(`${binPath} `);
}

export function tailLines(content: string, count: number): string[] {
  return content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .slice(-count);
}

export function chipManagerPort(configJson: string): number {
  try {
    const parsed = JSON.parse(configJson) as { port?: unknown };
    if (
      typeof parsed.port === "number" &&
      Number.isInteger(parsed.port) &&
      parsed.port > 0
    ) {
      return parsed.port;
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_CHIP_MANAGER_PORT;
}

export function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  } catch {
    return false;
  }
}

/** Start order; stop order is the reverse. */
export async function serviceDefinitions(): Promise<ServiceDefinition[]> {
  let chipPort = DEFAULT_CHIP_MANAGER_PORT;
  try {
    chipPort = chipManagerPort(await readFile(chipConfigPath, "utf-8"));
  } catch {
    // no generated config yet
  }
  return [
    {
      name: "chip-manager",
      binPath: chipManagerBinPath,
      configPath: chipConfigPath,
      healthUrl: `http://127.0.0.1:${chipPort}/chip/health`,
      pidFile: join(runDir, "chip-manager.pid"),
      logFile: join(logsDir, "chip-manager.log"),
    },
    {
      name: "engine",
      binPath: engineBinPath,
      configPath: engineConfigPath,
      healthUrl: `http://127.0.0.1:${ENGINE_PORT}/lathe/version`,
      pidFile: join(runDir, "engine.pid"),
      logFile: join(logsDir, "engine.log"),
    },
  ];
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function psCommand(pid: number): Promise<string> {
  try {
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "command="]);
    return stdout;
  } catch {
    return "";
  }
}

async function verifiedPid(def: ServiceDefinition): Promise<number | null> {
  let raw: string;
  try {
    raw = await readFile(def.pidFile, "utf-8");
  } catch {
    return null;
  }
  const pid = parsePid(raw);
  if (pid === null || !pidAlive(pid)) return null;
  return commandMatchesBinary(await psCommand(pid), def.binPath) ? pid : null;
}

async function isReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function logTail(file: string): Promise<string[]> {
  try {
    return tailLines(await readFile(file, "utf-8"), LOG_TAIL_LINES);
  } catch {
    return [];
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function binariesInstalled(): Promise<boolean> {
  const defs = await serviceDefinitions();
  const checks = await Promise.all(defs.map((d) => exists(d.binPath)));
  return checks.every(Boolean);
}

export async function serviceStatus(): Promise<ServiceStatus[]> {
  const defs = await serviceDefinitions();
  return Promise.all(
    defs.map(async (def) => ({
      name: def.name,
      installed: await exists(def.binPath),
      hasConfig: await exists(def.configPath),
      pid: await verifiedPid(def),
      reachable: await isReachable(def.healthUrl),
      logFile: def.logFile,
    })),
  );
}

async function startService(
  def: ServiceDefinition,
  onProgress?: (message: string) => void,
): Promise<StartResult> {
  if (await isReachable(def.healthUrl)) {
    return {
      name: def.name,
      ok: true,
      pid: await verifiedPid(def),
      message: "already running",
      logTail: [],
    };
  }
  if (!(await exists(def.binPath))) {
    return { name: def.name, ok: false, pid: null, message: "binary not installed", logTail: [] };
  }
  if (!(await exists(def.configPath))) {
    return {
      name: def.name,
      ok: false,
      pid: null,
      message: `config not found at ${def.configPath}`,
      logTail: [],
    };
  }

  await mkdir(logsDir, { recursive: true });
  await mkdir(runDir, { recursive: true });

  onProgress?.(`Starting ${def.name}...`);
  const log = await open(def.logFile, "a");
  const child = spawn(def.binPath, [], {
    detached: true,
    stdio: ["ignore", log.fd, log.fd],
    env: { ...process.env, CONFIG_PATH: def.configPath },
  });
  child.on("error", () => {});
  child.unref();
  await log.close();

  const pid = child.pid;
  if (!pid) {
    return {
      name: def.name,
      ok: false,
      pid: null,
      message: "failed to spawn",
      logTail: await logTail(def.logFile),
    };
  }
  await writeFile(def.pidFile, `${pid}\n`);

  onProgress?.(`Waiting for ${def.name} to become reachable...`);
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isReachable(def.healthUrl)) {
      return { name: def.name, ok: true, pid, message: `started (pid ${pid})`, logTail: [] };
    }
    if (!pidAlive(pid)) {
      await rm(def.pidFile, { force: true });
      return {
        name: def.name,
        ok: false,
        pid: null,
        message: "exited during startup",
        logTail: await logTail(def.logFile),
      };
    }
    await delay(READY_POLL_MS);
  }
  return {
    name: def.name,
    ok: false,
    pid,
    message: `not reachable after ${READY_TIMEOUT_MS / 1000}s`,
    logTail: await logTail(def.logFile),
  };
}

export async function startServices(
  onProgress?: (message: string) => void,
): Promise<StartResult[]> {
  const defs = await serviceDefinitions();
  const results: StartResult[] = [];
  for (const def of defs) {
    const previousFailed = results.some((r) => !r.ok);
    if (previousFailed) {
      results.push({
        name: def.name,
        ok: false,
        pid: null,
        message: "skipped: dependency failed to start",
        logTail: [],
      });
      continue;
    }
    results.push(await startService(def, onProgress));
  }
  return results;
}

async function stopService(def: ServiceDefinition): Promise<StopResult> {
  let raw: string;
  try {
    raw = await readFile(def.pidFile, "utf-8");
  } catch {
    return { name: def.name, ok: true, message: "not running" };
  }
  const pid = parsePid(raw);
  if (pid === null || !pidAlive(pid)) {
    await rm(def.pidFile, { force: true });
    return { name: def.name, ok: true, message: "not running (stale pidfile removed)" };
  }
  if (!commandMatchesBinary(await psCommand(pid), def.binPath)) {
    await rm(def.pidFile, { force: true });
    return {
      name: def.name,
      ok: true,
      message: `pid ${pid} is not ${def.name} — stale pidfile removed, process untouched`,
    };
  }
  process.kill(pid, "SIGTERM");
  const deadline = Date.now() + STOP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!pidAlive(pid)) {
      await rm(def.pidFile, { force: true });
      return { name: def.name, ok: true, message: `stopped (pid ${pid})` };
    }
    await delay(250);
  }
  return { name: def.name, ok: false, message: `pid ${pid} did not exit within ${STOP_TIMEOUT_MS / 1000}s` };
}

export async function stopServices(): Promise<StopResult[]> {
  const defs = await serviceDefinitions();
  const results: StopResult[] = [];
  for (const def of [...defs].reverse()) {
    results.push(await stopService(def));
  }
  return results;
}
