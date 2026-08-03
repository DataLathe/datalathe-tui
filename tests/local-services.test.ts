import { describe, it, expect } from "vitest";
import {
  parsePid,
  commandMatchesBinary,
  tailLines,
  chipManagerPort,
  isLocalUrl,
  serviceDefinitions,
  DEFAULT_CHIP_MANAGER_PORT,
} from "../src/utils/local-services.js";

describe("parsePid", () => {
  it("parses a plain pid with trailing newline", () => {
    expect(parsePid("12345\n")).toBe(12345);
    expect(parsePid("  678  ")).toBe(678);
  });

  it("rejects garbage, zero, and negatives", () => {
    expect(parsePid("")).toBeNull();
    expect(parsePid("abc")).toBeNull();
    expect(parsePid("0")).toBeNull();
    expect(parsePid("-5")).toBeNull();
  });
});

describe("commandMatchesBinary", () => {
  const bin = "/Users/me/.datalathe/bin/engine";

  it("matches the exact binary path", () => {
    expect(commandMatchesBinary(`${bin}\n`, bin)).toBe(true);
  });

  it("matches the binary path with arguments", () => {
    expect(commandMatchesBinary(`${bin} --flag`, bin)).toBe(true);
  });

  it("rejects a recycled pid running something else", () => {
    expect(commandMatchesBinary("/usr/bin/vim", bin)).toBe(false);
    expect(commandMatchesBinary("", bin)).toBe(false);
  });

  it("rejects a different binary that shares a prefix", () => {
    expect(commandMatchesBinary(`${bin}-evil`, bin)).toBe(false);
  });
});

describe("tailLines", () => {
  it("returns the last N non-empty lines", () => {
    expect(tailLines("a\nb\n\nc\nd\n", 2)).toEqual(["c", "d"]);
  });

  it("returns everything when shorter than N", () => {
    expect(tailLines("only\n", 5)).toEqual(["only"]);
    expect(tailLines("", 5)).toEqual([]);
  });
});

describe("chipManagerPort", () => {
  it("reads the port from the generated config", () => {
    expect(chipManagerPort('{"database_file_path": "/x", "port": 6001}')).toBe(6001);
  });

  it("falls back to the default on missing or invalid port", () => {
    expect(chipManagerPort("{}")).toBe(DEFAULT_CHIP_MANAGER_PORT);
    expect(chipManagerPort('{"port": "5053"}')).toBe(DEFAULT_CHIP_MANAGER_PORT);
    expect(chipManagerPort("not json")).toBe(DEFAULT_CHIP_MANAGER_PORT);
  });
});

describe("isLocalUrl", () => {
  it("accepts localhost and loopback addresses", () => {
    expect(isLocalUrl("http://localhost:3000")).toBe(true);
    expect(isLocalUrl("http://127.0.0.1:3000/lathe")).toBe(true);
    expect(isLocalUrl("http://[::1]:3000")).toBe(true);
  });

  it("rejects remote hosts and invalid urls", () => {
    expect(isLocalUrl("http://engine.internal:3000")).toBe(false);
    expect(isLocalUrl("http://192.168.1.10:3000")).toBe(false);
    expect(isLocalUrl("not a url")).toBe(false);
  });
});

describe("serviceDefinitions", () => {
  it("starts chip-manager before engine and points CONFIG_PATH at generated configs", async () => {
    const defs = await serviceDefinitions();
    expect(defs.map((d) => d.name)).toEqual(["chip-manager", "engine"]);
    const chip = defs[0]!;
    const engine = defs[1]!;
    expect(chip.configPath.endsWith("chip.conf.json")).toBe(true);
    expect(engine.configPath.endsWith("engine.conf.json")).toBe(true);
    expect(engine.healthUrl).toBe("http://127.0.0.1:3000/lathe/version");
    expect(chip.healthUrl).toContain("/chip/health");
    expect(chip.pidFile.endsWith("chip-manager.pid")).toBe(true);
    expect(engine.logFile.endsWith("engine.log")).toBe(true);
  });
});
