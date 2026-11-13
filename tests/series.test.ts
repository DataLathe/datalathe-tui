import { describe, it, expect } from "vitest";
import type { SeriesSlotsResponse } from "@datalathe/client";
import { seriesRows, rowReference, seriesReference } from "../src/utils/series.js";

const view: SeriesSlotsResponse = {
  seriesId: "1234",
  asOf: "r7f3a91c2-12",
  revision: 12,
  tables: [
    {
      tableName: "loan04",
      contractMajor: 1,
      columns: [
        ["id", "INTEGER"],
        ["amount", "DOUBLE"],
      ],
      slots: [
        { partitionValue: "2026-09-30", chipId: "c8", subChipId: "c8-a", version: 8, columnCount: 1, publishedRevision: 9 },
        { partitionValue: "2026-10-31", chipId: "c9", subChipId: "c9-a", version: 9, columnCount: 2, publishedRevision: 11 },
      ],
    },
    {
      tableName: "loan_origination",
      contractMajor: 2,
      columns: [["loan_id", "VARCHAR"]],
      slots: [{ partitionValue: "", chipId: "c7", subChipId: "c7", version: 7, columnCount: 1, publishedRevision: 7 }],
    },
  ],
};

describe("seriesRows", () => {
  it("lists one row per table when nothing is expanded", () => {
    expect(seriesRows(view, new Set())).toEqual([
      { kind: "table", tableName: "loan04", contractMajor: 1, slotCount: 2, columnCount: 2 },
      { kind: "table", tableName: "loan_origination", contractMajor: 2, slotCount: 1, columnCount: 1 },
    ]);
  });

  it("puts an expanded table's slots under it", () => {
    const rows = seriesRows(view, new Set(["loan04"]));
    expect(rows.map((r) => (r.kind === "slot" ? `slot:${r.partitionValue}` : `table:${r.tableName}`))).toEqual([
      "table:loan04",
      "slot:2026-09-30",
      "slot:2026-10-31",
      "table:loan_origination",
    ]);
  });
});

describe("references", () => {
  it("names the whole series", () => {
    expect(seriesReference("1234")).toBe("series:1234@latest");
  });

  it("names a table for a table row and for an unpartitioned slot", () => {
    const rows = seriesRows(view, new Set(["loan_origination"]));
    expect(rowReference("1234", rows[0])).toBe("series:1234/loan04@latest");
    expect(rowReference("1234", rows[2])).toBe("series:1234/loan_origination@latest");
  });

  it("names one partition for a partitioned slot", () => {
    const rows = seriesRows(view, new Set(["loan04"]));
    expect(rowReference("1234", rows[2])).toBe("series:1234/loan04/2026-10-31@latest");
  });
});
