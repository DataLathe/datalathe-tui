import type { Chip, ChipMetadata, ChipTag, ChipsResponse } from "@datalathe/client";

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
  partitionW: number;
  tagsW: number;
  dateW: number;
  descW: number;
}

/** Check whether any chip in the list has sub-chips. */
export function hasAnySubChips(allChips: Chip[]): boolean {
  return allChips.some((c) => c.chip_id !== c.sub_chip_id);
}

/** Check whether any chip in the list has partition values. */
export function hasAnyPartitions(allChips: Chip[]): boolean {
  return allChips.some((c) => c.partition_value);
}

/** Pre-index chips and tags by chip_id for O(1) lookups. */
export interface ChipIndex {
  chipsByChipId: Map<string, Chip[]>;
  tagsByChipId: Map<string, ChipTag[]>;
}

export function buildChipIndex(allChips: Chip[], allTags: ChipTag[]): ChipIndex {
  const chipsByChipId = new Map<string, Chip[]>();
  for (const c of allChips) {
    const list = chipsByChipId.get(c.chip_id);
    if (list) list.push(c);
    else chipsByChipId.set(c.chip_id, [c]);
  }
  const tagsByChipId = new Map<string, ChipTag[]>();
  for (const t of allTags) {
    const list = tagsByChipId.get(t.chip_id);
    if (list) list.push(t);
    else tagsByChipId.set(t.chip_id, [t]);
  }
  return { chipsByChipId, tagsByChipId };
}

/** Build a compact partition summary for a chip. */
export function partitionSummary(chipId: string, index: ChipIndex): string {
  const chips = index.chipsByChipId.get(chipId) ?? [];
  const values = [...new Set(
    chips.filter((c) => c.partition_value).map((c) => c.partition_value),
  )];
  if (values.length === 0) return "\u2014";
  if (values.length <= 2) return values.join(", ");
  return `${values.slice(0, 2).join(", ")} +${values.length - 2}`;
}

/** Build a compact tag summary for a chip. */
export function tagSummary(chipId: string, index: ChipIndex): string {
  const chipTags = index.tagsByChipId.get(chipId) ?? [];
  if (chipTags.length === 0) return "\u2014";
  return chipTags.map((t) => `${t.key}=${t.value}`).join(" ");
}

/** Count sub-chips for a given chip ID. */
export function subChipCount(chipId: string, index: ChipIndex): number {
  const chips = index.chipsByChipId.get(chipId) ?? [];
  return chips.filter((c) => c.chip_id !== c.sub_chip_id).length;
}

export interface ChipColumnsOptions {
  availableWidth: number;
  indicatorWidth?: number;
  showSubChips?: boolean;
  showPartitions?: boolean;
  showTags?: boolean;
}

/** Compute column widths for chip table based on available width. */
export function chipColumns(opts: ChipColumnsOptions): ChipColumnWidths {
  const { availableWidth, indicatorWidth = 4, showSubChips = true, showPartitions = false, showTags = false } = opts;
  // Reserve space for Select/MultiSelect indicator (e.g. "› ☑ ")
  const usable = availableWidth - indicatorWidth;
  const subChipsW = showSubChips ? 8 : 0;
  const partitionW = showPartitions ? 14 : 0;
  const tagsW = showTags ? 16 : 0;
  // Fixed columns: date(12) + optional columns + gaps (2 per gap between columns)
  let colCount = 3; // name, table, date
  if (showSubChips) colCount++;
  if (showPartitions) colCount++;
  if (showTags) colCount++;
  const gapCount = colCount; // gaps between columns + before desc
  const fixed = 12 + subChipsW + partitionW + tagsW + gapCount * 2;
  const flex = Math.max(30, usable - fixed);
  const nameW = Math.max(10, Math.floor(flex * 0.3));
  const tableW = Math.max(10, Math.floor(flex * 0.35));
  const dateW = 12;
  const descW = Math.max(0, usable - nameW - tableW - subChipsW - partitionW - tagsW - dateW - gapCount * 2);
  return { nameW, tableW, subChipsW, partitionW, tagsW, dateW, descW };
}

/** Build a fixed-width label for a chip Select/MultiSelect option. */
export function chipLabel(
  id: string,
  meta: ChipMetadata | undefined,
  index: ChipIndex,
  cols: ChipColumnWidths,
): string {
  const chips = index.chipsByChipId.get(id) ?? [];
  const name = meta?.name ?? id.slice(0, 12);
  const tables = [...new Set(chips.map((c) => c.table_name))];
  const table = tables.length > 0 ? tables.join(", ") : "\u2014";
  const created = meta ? formatDate(meta.created_at) : "\u2014";
  const desc = meta?.description ?? "";
  const parts = [fit(name, cols.nameW), fit(table, cols.tableW)];
  if (cols.subChipsW > 0) {
    const sc = chips.filter((c) => c.chip_id !== c.sub_chip_id).length;
    parts.push(fit(sc > 0 ? `${sc} subs` : "\u2014", cols.subChipsW));
  }
  if (cols.partitionW > 0) {
    parts.push(fit(partitionSummary(id, index), cols.partitionW));
  }
  if (cols.tagsW > 0) {
    parts.push(fit(tagSummary(id, index), cols.tagsW));
  }
  parts.push(fit(created, cols.dateW));
  if (cols.descW > 5) parts.push(fit(desc, cols.descW));
  return parts.join("  ");
}

/** Build a header string matching chipLabel column layout. */
export function chipHeader(cols: ChipColumnWidths, indicatorWidth = 4): string {
  const parts = [fit("Name", cols.nameW), fit("Tables", cols.tableW)];
  if (cols.subChipsW > 0) parts.push(fit("Sub-chips", cols.subChipsW));
  if (cols.partitionW > 0) parts.push(fit("Partitions", cols.partitionW));
  if (cols.tagsW > 0) parts.push(fit("Tags", cols.tagsW));
  parts.push(fit("Created", cols.dateW));
  if (cols.descW > 5) parts.push(fit("Description", cols.descW));
  return " ".repeat(indicatorWidth) + parts.join("  ");
}

/** Shared config for screens that display chip picker lists. */
export interface ChipDisplayConfig {
  allChips: Chip[];
  allTags: ChipTag[];
  metaMap: Map<string, ChipMetadata>;
  index: ChipIndex;
  mainChipIds: string[];
  cols: ChipColumnWidths;
}

export function chipDisplayConfig(
  chipsData: ChipsResponse | null | undefined,
  panelWidth: number,
  indicatorWidth = 4,
): ChipDisplayConfig {
  const allChips = chipsData?.chips ?? [];
  const allTags = chipsData?.tags ?? [];
  const metadata = chipsData?.metadata ?? [];

  const metaMap = new Map<string, ChipMetadata>();
  for (const m of metadata) {
    metaMap.set(m.chip_id, m);
  }

  const index = buildChipIndex(allChips, allTags);

  const mainChipIds = [...new Set(
    allChips.filter((c) => c.chip_id === c.sub_chip_id).map((c) => c.chip_id),
  )];

  const cols = chipColumns({
    availableWidth: panelWidth,
    indicatorWidth,
    showSubChips: hasAnySubChips(allChips),
    showPartitions: hasAnyPartitions(allChips),
    showTags: allTags.length > 0,
  });

  return { allChips, allTags, metaMap, index, mainChipIds, cols };
}
