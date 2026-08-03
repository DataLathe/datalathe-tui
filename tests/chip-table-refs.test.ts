import { describe, it, expect } from "vitest";
import type { Chip } from "@datalathe/client";
import { buildTableRefs, appendRef, catalogName } from "../src/utils/chip-table-refs.js";

function row(chipId: string, subChipId: string, tableName: string, partitionValue = ""): Chip {
  return { chipId, subChipId, tableName, partitionValue };
}

describe("buildTableRefs", () => {
  it("produces a single catalog reference for a lone sub-chip", () => {
    const refs = buildTableRefs([row("c1", "sub-aaaa-1111", "orders")], ["c1"]);
    expect(refs).toEqual([
      { label: "orders @ sub-aaaa", sql: "sub_aaaa_1111.main.orders" },
    ]);
  });

  it("labels with the partition value when present", () => {
    const refs = buildTableRefs([row("c1", "s1", "orders", "2026-01")], ["c1"]);
    expect(refs[0]!.label).toBe("orders @ 2026-01");
  });

  it("adds a UNION ALL entry first for a table split across sub-chips", () => {
    const refs = buildTableRefs(
      [row("c1", "s1", "orders", "a"), row("c1", "s2", "orders", "b")],
      ["c1"],
    );
    expect(refs).toEqual([
      {
        label: "orders (all 2 partitions)",
        sql: "(SELECT * FROM s1.main.orders UNION ALL SELECT * FROM s2.main.orders)",
      },
      { label: "orders @ a", sql: "s1.main.orders" },
      { label: "orders @ b", sql: "s2.main.orders" },
    ]);
  });

  it("groups by table in first-appearance order across chips", () => {
    const refs = buildTableRefs(
      [
        row("c1", "s1", "orders", "a"),
        row("c2", "s2", "customers"),
        row("c1", "s3", "orders", "b"),
      ],
      ["c1", "c2"],
    );
    expect(refs.map((r) => r.label)).toEqual([
      "orders (all 2 partitions)",
      "orders @ a",
      "orders @ b",
      "customers @ s2",
    ]);
  });

  it("ignores rows from unselected chips", () => {
    const refs = buildTableRefs(
      [row("c1", "s1", "orders"), row("c2", "s2", "orders")],
      ["c1"],
    );
    expect(refs).toEqual([{ label: "orders @ s1", sql: "s1.main.orders" }]);
  });

  it("returns empty for no selection or no rows", () => {
    expect(buildTableRefs([], ["c1"])).toEqual([]);
    expect(buildTableRefs([row("c1", "s1", "t")], [])).toEqual([]);
  });
});

describe("catalogName", () => {
  it("replaces dashes and keeps no prefix for letter-leading ids", () => {
    expect(catalogName("f9636cf0-1f23-4143-97ed-6d51bc2bfbe9")).toBe(
      "f9636cf0_1f23_4143_97ed_6d51bc2bfbe9",
    );
  });

  it("prefixes s_ for ids not starting with a letter", () => {
    expect(catalogName("93a8a5fb-ff89-400f-8c73-b251966bdc5b")).toBe(
      "s_93a8a5fb_ff89_400f_8c73_b251966bdc5b",
    );
  });
});

describe("appendRef", () => {
  it("appends with a leading space to existing text", () => {
    expect(appendRef("SELECT * FROM", "s_s1.main.orders")).toBe(
      "SELECT * FROM s_s1.main.orders",
    );
  });

  it("replaces blank text without a leading space", () => {
    expect(appendRef("", "s_s1.main.orders")).toBe("s_s1.main.orders");
    expect(appendRef("   ", "s_s1.main.orders")).toBe("s_s1.main.orders");
  });
});
