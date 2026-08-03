import type { Chip } from "@datalathe/client";

export interface TableRef {
  label: string;
  sql: string;
}

// Mirrors the engine's sanitize_chip_id: dashes become underscores, and the
// s_ prefix applies only when the id does not start with a letter.
export function catalogName(subChipId: string): string {
  const sanitized = subChipId.replace(/-/g, "_");
  return /^[a-zA-Z]/.test(subChipId) ? sanitized : `s_${sanitized}`;
}

/**
 * Insertable raw-SQL references for the selected chips' tables, grouped by
 * table in first-appearance order. A table split across multiple sub-chips
 * gets a UNION ALL entry first, then one entry per sub-chip.
 */
export function buildTableRefs(rows: Chip[], selectedChipIds: string[]): TableRef[] {
  const selected = new Set(selectedChipIds);
  const byTable = new Map<string, Chip[]>();
  for (const row of rows) {
    if (!selected.has(row.chipId)) continue;
    const group = byTable.get(row.tableName);
    if (group) group.push(row);
    else byTable.set(row.tableName, [row]);
  }

  const refs: TableRef[] = [];
  for (const [table, group] of byTable) {
    if (group.length > 1) {
      const union = group
        .map((r) => `SELECT * FROM ${catalogName(r.subChipId)}.main.${table}`)
        .join(" UNION ALL ");
      refs.push({
        label: `${table} (all ${group.length} partitions)`,
        sql: `(${union})`,
      });
    }
    for (const r of group) {
      refs.push({
        label: `${table} @ ${r.partitionValue || r.subChipId.slice(0, 8)}`,
        sql: `${catalogName(r.subChipId)}.main.${table}`,
      });
    }
  }
  return refs;
}

export function appendRef(current: string, refSql: string): string {
  return current.trim().length > 0 ? `${current} ${refSql}` : refSql;
}
