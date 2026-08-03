import type { ChipMetadata } from "@datalathe/client";
import type { ChipIndex } from "./chip-options.js";

/**
 * Case-insensitive substring match of `filter` against a chip's metadata
 * name, chip ID, table names, and tags rendered as `key=value` (so a bare
 * key or bare value also hits). An empty/blank filter matches everything.
 */
export function chipMatchesFilter(
  filter: string,
  chipId: string,
  meta: ChipMetadata | undefined,
  index: ChipIndex,
): boolean {
  const needle = filter.trim().toLowerCase();
  if (!needle) return true;
  if (chipId.toLowerCase().includes(needle)) return true;
  if (meta?.name.toLowerCase().includes(needle)) return true;
  const chips = index.chipsByChipId.get(chipId) ?? [];
  if (chips.some((c) => c.tableName.toLowerCase().includes(needle))) return true;
  const tags = index.tagsByChipId.get(chipId) ?? [];
  return tags.some((t) => `${t.key}=${t.value}`.toLowerCase().includes(needle));
}

export function filterChipIds(
  chipIds: string[],
  filter: string,
  metaMap: Map<string, ChipMetadata>,
  index: ChipIndex,
): string[] {
  if (!filter.trim()) return chipIds;
  return chipIds.filter((id) =>
    chipMatchesFilter(filter, id, metaMap.get(id), index),
  );
}
