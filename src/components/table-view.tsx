import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { brand } from "../theme.js";

const MAX_COL_WIDTH = 30;
const SCROLL_STEP = 8;

interface TableViewProps {
  data: Record<string, unknown>[];
  /** Available character width for the table. */
  viewWidth?: number;
  /** Available row count for the table (header + separator + data rows + footer). */
  viewHeight?: number;
  emptyMessage?: string;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function TableView({
  data,
  viewWidth = 80,
  viewHeight = 20,
  emptyMessage = "No data",
}: TableViewProps) {
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);

  if (data.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color={brand.muted}>{emptyMessage}</Text>
      </Box>
    );
  }

  const columns = Object.keys(data[0]!);

  // Compute column widths
  const widths = columns.map((col) => {
    let max = col.length;
    for (const row of data) {
      const val = String(row[col] ?? "");
      if (val.length > max) max = val.length;
    }
    return Math.min(max, MAX_COL_WIDTH);
  });

  const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.length));

  // Build full-width row strings
  const headerStr = columns
    .map((col, i) => pad(truncate(col, widths[i]!), widths[i]!))
    .join(" │ ");
  const sepStr = widths.map((w) => "─".repeat(w)).join("─┼─");

  const rowStrings = data.map((row) =>
    columns
      .map((col, ci) => {
        const val = String(row[col] ?? "");
        return pad(truncate(val, widths[ci]!), widths[ci]!);
      })
      .join(" │ "),
  );

  const totalWidth = headerStr.length;

  // Pagination: reserve lines for header(1) + sep(1) + footer(1) + status(1) = 4
  const pageSize = Math.max(1, viewHeight - 4);
  const maxScrollY = Math.max(0, data.length - pageSize);
  const clampedY = Math.min(scrollY, maxScrollY);
  const visibleRows = rowStrings.slice(clampedY, clampedY + pageSize);

  // Horizontal: clamp scrollX
  const maxScrollX = Math.max(0, totalWidth - viewWidth);
  const clampedX = Math.min(scrollX, maxScrollX);

  // Slice a line to the visible horizontal window
  const hSlice = (line: string): string => {
    const sliced = line.slice(clampedX, clampedX + viewWidth);
    return sliced;
  };

  useInput((_input, key) => {
    if (key.leftArrow) {
      setScrollX((x) => Math.max(0, x - SCROLL_STEP));
    } else if (key.rightArrow) {
      setScrollX((x) => Math.min(maxScrollX, x + SCROLL_STEP));
    } else if (key.upArrow) {
      setScrollY((y) => Math.max(0, y - 1));
    } else if (key.downArrow) {
      setScrollY((y) => Math.min(maxScrollY, y + 1));
    } else if (key.pageUp) {
      setScrollY((y) => Math.max(0, y - pageSize));
    } else if (key.pageDown) {
      setScrollY((y) => Math.min(maxScrollY, y + pageSize));
    }
  });

  const page = Math.floor(clampedY / pageSize) + 1;
  const totalPages = Math.ceil(data.length / pageSize);
  const colInfo = `${columns.length} cols`;
  const rowInfo = `${data.length} rows`;
  const pageInfo = totalPages > 1 ? `pg ${page}/${totalPages}` : "";
  const hInfo = maxScrollX > 0 ? `col ◄►` : "";
  const statusParts = [colInfo, rowInfo, pageInfo, hInfo].filter(Boolean);

  return (
    <Box flexDirection="column">
      <Text wrap="truncate" color={brand.cyan} bold>
        {hSlice(headerStr)}
      </Text>
      <Text wrap="truncate" color={brand.border}>
        {hSlice(sepStr)}
      </Text>
      {visibleRows.map((row, ri) => (
        <Text wrap="truncate" key={clampedY + ri} color={brand.text}>
          {hSlice(row)}
        </Text>
      ))}
      <Text color={brand.muted}>
        {statusParts.join(" · ")}
        {totalPages > 1 && (
          <Text color={brand.muted} dimColor>
            {"  ↑↓:scroll  PgUp/PgDn:page"}
          </Text>
        )}
        {maxScrollX > 0 && (
          <Text color={brand.muted} dimColor>
            {"  ←→:pan"}
          </Text>
        )}
      </Text>
    </Box>
  );
}
