import type { SeriesSlotsResponse } from "@datalathe/client";

export type SeriesRow =
  | { kind: "table"; tableName: string; contractMajor: number; slotCount: number; columnCount: number }
  | {
      kind: "slot";
      tableName: string;
      partitionValue: string;
      chipId: string;
      version: number;
      columnCount: number | null;
    };

/** One row per table, followed by its slots when the table is expanded. */
export function seriesRows(view: SeriesSlotsResponse, expanded: ReadonlySet<string>): SeriesRow[] {
  const rows: SeriesRow[] = [];
  for (const table of view.tables) {
    rows.push({
      kind: "table",
      tableName: table.tableName,
      contractMajor: table.contractMajor,
      slotCount: table.slots.length,
      columnCount: table.columns.length,
    });
    if (!expanded.has(table.tableName)) continue;
    for (const slot of table.slots) {
      rows.push({
        kind: "slot",
        tableName: table.tableName,
        partitionValue: slot.partitionValue,
        chipId: slot.chipId,
        version: slot.version,
        columnCount: slot.columnCount ?? null,
      });
    }
  }
  return rows;
}

/** The reference that a query uses to read the row: a table, or one partition of it. */
export function rowReference(seriesId: string, row: SeriesRow): string {
  if (row.kind === "slot" && row.partitionValue !== "") {
    return `series:${seriesId}/${row.tableName}/${row.partitionValue}@latest`;
  }
  return `series:${seriesId}/${row.tableName}@latest`;
}

export function seriesReference(seriesId: string): string {
  return `series:${seriesId}@latest`;
}

export function publishedWhen(unixSeconds: number | null | undefined): string {
  return unixSeconds == null ? "" : new Date(unixSeconds * 1000).toLocaleString();
}
