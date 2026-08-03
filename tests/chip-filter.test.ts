import { describe, it, expect } from "vitest";
import type { Chip, ChipMetadata, ChipTag } from "@datalathe/client";
import { chipMatchesFilter, filterChipIds } from "../src/utils/chip-filter.js";
import { buildChipIndex } from "../src/utils/chip-options.js";

const chips: Chip[] = [
  { chipId: "abc-123", subChipId: "s1", tableName: "orders", partitionValue: "" },
  { chipId: "abc-123", subChipId: "s2", tableName: "customers", partitionValue: "" },
  { chipId: "def-456", subChipId: "s3", tableName: "inventory", partitionValue: "" },
];

const tags: ChipTag[] = [
  { chipId: "abc-123", key: "env", value: "prod" },
  { chipId: "def-456", key: "tenant", value: "acme" },
];

const metadata: ChipMetadata[] = [
  { chipId: "abc-123", name: "Sales Data", description: "", createdAt: 0 },
  { chipId: "def-456", name: "Warehouse", description: "", createdAt: 0 },
];

const index = buildChipIndex(chips, tags);
const metaMap = new Map(metadata.map((m) => [m.chipId, m]));

describe("chipMatchesFilter", () => {
  it("matches everything on an empty or blank filter", () => {
    expect(chipMatchesFilter("", "abc-123", metaMap.get("abc-123"), index)).toBe(true);
    expect(chipMatchesFilter("   ", "abc-123", metaMap.get("abc-123"), index)).toBe(true);
  });

  it("matches the metadata name case-insensitively", () => {
    expect(chipMatchesFilter("sales", "abc-123", metaMap.get("abc-123"), index)).toBe(true);
    expect(chipMatchesFilter("SALES", "abc-123", metaMap.get("abc-123"), index)).toBe(true);
    expect(chipMatchesFilter("sales", "def-456", metaMap.get("def-456"), index)).toBe(false);
  });

  it("matches the chip id substring", () => {
    expect(chipMatchesFilter("c-12", "abc-123", metaMap.get("abc-123"), index)).toBe(true);
    expect(chipMatchesFilter("c-12", "def-456", metaMap.get("def-456"), index)).toBe(false);
  });

  it("matches any table name", () => {
    expect(chipMatchesFilter("CUSTOM", "abc-123", metaMap.get("abc-123"), index)).toBe(true);
    expect(chipMatchesFilter("orders", "abc-123", metaMap.get("abc-123"), index)).toBe(true);
    expect(chipMatchesFilter("orders", "def-456", metaMap.get("def-456"), index)).toBe(false);
  });

  it("matches tags as key=value, bare key, and bare value", () => {
    expect(chipMatchesFilter("env=prod", "abc-123", metaMap.get("abc-123"), index)).toBe(true);
    expect(chipMatchesFilter("env", "abc-123", metaMap.get("abc-123"), index)).toBe(true);
    expect(chipMatchesFilter("prod", "abc-123", metaMap.get("abc-123"), index)).toBe(true);
    expect(chipMatchesFilter("env=stage", "abc-123", metaMap.get("abc-123"), index)).toBe(false);
  });

  it("handles a chip without metadata", () => {
    expect(chipMatchesFilter("orphan", "ghi-789", undefined, index)).toBe(false);
    expect(chipMatchesFilter("ghi", "ghi-789", undefined, index)).toBe(true);
  });
});

describe("filterChipIds", () => {
  const ids = ["abc-123", "def-456"];

  it("returns all ids for a blank filter", () => {
    expect(filterChipIds(ids, "", metaMap, index)).toEqual(ids);
    expect(filterChipIds(ids, "  ", metaMap, index)).toEqual(ids);
  });

  it("keeps only matching ids", () => {
    expect(filterChipIds(ids, "acme", metaMap, index)).toEqual(["def-456"]);
    expect(filterChipIds(ids, "orders", metaMap, index)).toEqual(["abc-123"]);
  });

  it("returns empty when nothing matches", () => {
    expect(filterChipIds(ids, "nope", metaMap, index)).toEqual([]);
  });
});
