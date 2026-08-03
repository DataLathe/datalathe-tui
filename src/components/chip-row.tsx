import React from "react";
import { Box, Text } from "ink";
import type { Chip, ChipMetadata, ChipTag } from "@datalathe/client";
import { brand } from "../theme.js";
import {
  type ChipIndex,
  formatDate,
  subChipCount,
  partitionSummary,
  fit,
} from "../utils/chip-options.js";

interface ChipRowProps {
  chipId: string;
  meta: ChipMetadata | undefined;
  index: ChipIndex;
  isCursor: boolean;
  isExpanded: boolean;
}

export function ChipRow({ chipId, meta, index, isCursor, isExpanded }: ChipRowProps) {
  const subs = subChipCount(chipId, index);
  const chips = index.chipsByChipId.get(chipId) ?? [];
  const tables = [...new Set(chips.map((c: Chip) => c.tableName))];
  const chipTags = index.tagsByChipId.get(chipId) ?? [];

  return (
    <Box flexDirection="column">
      {/* Summary row */}
      <Box>
        <Text color={isCursor ? brand.cyan : brand.muted}>
          {isCursor ? "▶ " : "  "}
        </Text>
        <Text color={isCursor ? brand.cyan : brand.text} bold={isCursor}>
          {fit(meta?.name ?? chipId.slice(0, 12), 22)}
        </Text>
        <Text color={brand.muted}>  </Text>
        <Text color={brand.violet}>
          {fit(tables.join(", ") || "-", 18)}
        </Text>
        <Text color={brand.muted}>  </Text>
        <Text color={brand.muted}>
          {meta ? formatDate(meta.createdAt) : "-"}
        </Text>
        <Text color={brand.muted}>  </Text>
        <Text color={brand.indigo}>
          {subs > 0 ? `${subs} sub${subs !== 1 ? "s" : ""}` : ""}
        </Text>
        {chipTags.length > 0 && (
          <>
            <Text color={brand.muted}>  </Text>
            <Text color={brand.muted} dimColor>
              {chipTags.map((t: ChipTag) => `${t.key}=${t.value}`).join(" ")}
            </Text>
          </>
        )}
      </Box>

      {/* Expanded detail */}
      {isExpanded && (
        <Box
          flexDirection="column"
          paddingLeft={4}
          marginBottom={1}
          borderStyle="single"
          borderColor={brand.border}
          paddingX={1}
        >
          <Text>
            <Text color={brand.muted}>ID:      </Text>
            <Text color={brand.text}>{chipId}</Text>
          </Text>
          {meta?.name && (
            <Text>
              <Text color={brand.muted}>Name:    </Text>
              <Text color={brand.text}>{meta.name}</Text>
            </Text>
          )}
          {meta?.description && (
            <Text>
              <Text color={brand.muted}>Desc:    </Text>
              <Text color={brand.text}>{meta.description}</Text>
            </Text>
          )}
          {meta?.query && (
            <Text>
              <Text color={brand.muted}>Query:   </Text>
              <Text color={brand.violet}>{meta.query}</Text>
            </Text>
          )}
          <Text>
            <Text color={brand.muted}>Tables:  </Text>
            <Text color={brand.violet}>
              {tables.join(", ") || "-"}
            </Text>
          </Text>
          {meta?.tables && (
            <Text>
              <Text color={brand.muted}>Sources: </Text>
              <Text color={brand.text}>{meta.tables}</Text>
            </Text>
          )}
          <Text>
            <Text color={brand.muted}>Created: </Text>
            <Text color={brand.text}>
              {meta
                ? new Date(meta.createdAt * 1000).toLocaleString()
                : "-"}
            </Text>
          </Text>
          {subs > 0 && (
            <Text>
              <Text color={brand.muted}>Subs:    </Text>
              <Text color={brand.text}>
                {subs} partition{subs !== 1 ? "s" : ""} ({partitionSummary(chipId, index)})
              </Text>
            </Text>
          )}
          {chipTags.length > 0 && (
            <Box flexDirection="column">
              <Text color={brand.muted}>Tags:</Text>
              {chipTags.map((t: ChipTag) => (
                <Text key={t.key}>
                  <Text color={brand.muted}>  {t.key}: </Text>
                  <Text color={brand.text}>{t.value}</Text>
                </Text>
              ))}
            </Box>
          )}
          {meta?.storageBucket && (
            <Text>
              <Text color={brand.muted}>Storage: </Text>
              <Text color={brand.text}>
                s3://{meta.storageBucket}
                {meta.storageKeyPrefix
                  ? `/${meta.storageKeyPrefix}`
                  : ""}
              </Text>
            </Text>
          )}
          {meta?.ttlDays != null && (
            <Text>
              <Text color={brand.muted}>TTL:     </Text>
              <Text color={brand.text}>{meta.ttlDays} days</Text>
            </Text>
          )}

          <Box marginTop={1} gap={2}>
            <Text color={brand.muted}>v:full detail</Text>
            <Text color={brand.muted}>s:query</Text>
            <Text color={brand.muted}>x:raw sql</Text>
            <Text color={brand.muted}>c:create from chip</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
