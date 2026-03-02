import type { Chip, ChipMetadata } from "@datalathe/client";

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Format a Unix-seconds epoch as "Mon DD, YYYY" (always 12 chars). */
export function formatDate(epoch: number): string {
  const d = new Date(epoch * 1000);
  const mon = SHORT_MONTHS[d.getMonth()]!;
  const day = String(d.getDate()).padStart(2, " ");
  return `${mon} ${day}, ${d.getFullYear()}`;
}

/** Pad or truncate a string to a fixed width. */
export function fit(str: string, width: number): string {
  if (str.length > width) return str.slice(0, width - 1) + "\u2026";
  return str.padEnd(width);
}

export interface ChipColumnWidths {
  nameW: number;
  tableW: number;
  subChipsW: number;
  dateW: number;
  descW: number;
}

/** Check whether any chip in the list has sub-chips. */
export function hasAnySubChips(allChips: Chip[]): boolean {
  return allChips.some((c) => c.chip_id !== c.sub_chip_id);
}

/** Compute column widths for chip table based on available width. */
export function chipColumns(availableWidth: number, indicatorWidth = 4, showSubChips = true): ChipColumnWidths {
  // Reserve space for Select/MultiSelect indicator (e.g. "› ☑ ")
  const usable = availableWidth - indicatorWidth;
  const subChipsW = showSubChips ? 8 : 0;
  // Fixed columns: date(12) + subChips + gaps (2 per gap between columns)
  const gapCount = showSubChips ? 4 : 3;
  const fixed = 12 + subChipsW + gapCount * 2;
  const flex = Math.max(30, usable - fixed);
  const nameW = Math.max(10, Math.floor(flex * 0.3));
  const tableW = Math.max(10, Math.floor(flex * 0.35));
  const dateW = 12;
  const descW = Math.max(0, usable - nameW - tableW - subChipsW - dateW - gapCount * 2);
  return { nameW, tableW, subChipsW, dateW, descW };
}

/** Build a fixed-width label for a chip Select/MultiSelect option. */
export function chipLabel(
  id: string,
  meta: ChipMetadata | undefined,
  allChips: Chip[],
  cols: ChipColumnWidths,
): string {
  const name = meta?.name ?? id.slice(0, 12);
  const tables = [...new Set(allChips.filter((c) => c.chip_id === id).map((c) => c.table_name))];
  const table = tables.length > 0 ? tables.join(", ") : "\u2014";
  const created = meta ? formatDate(meta.created_at) : "\u2014";
  const desc = meta?.description ?? "";
  const parts = [fit(name, cols.nameW), fit(table, cols.tableW)];
  if (cols.subChipsW > 0) {
    const subCount = allChips.filter((c) => c.chip_id === id && c.chip_id !== c.sub_chip_id).length;
    parts.push(fit(subCount > 0 ? `${subCount} subs` : "\u2014", cols.subChipsW));
  }
  parts.push(fit(created, cols.dateW));
  if (cols.descW > 5) parts.push(fit(desc, cols.descW));
  return parts.join("  ");
}

/** Build a header string matching chipLabel column layout. */
export function chipHeader(cols: ChipColumnWidths, indicatorWidth = 4): string {
  const parts = [fit("Name", cols.nameW), fit("Tables", cols.tableW)];
  if (cols.subChipsW > 0) parts.push(fit("Sub-chips", cols.subChipsW));
  parts.push(fit("Created", cols.dateW));
  if (cols.descW > 5) parts.push(fit("Description", cols.descW));
  return " ".repeat(indicatorWidth) + parts.join("  ");
}

/** Count sub-chips for a given chip ID. */
export function subChipCount(chipId: string, allChips: Chip[]): number {
  return allChips.filter((c) => c.chip_id === chipId && c.chip_id !== c.sub_chip_id).length;
}
