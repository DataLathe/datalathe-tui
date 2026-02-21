import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { Spinner } from "@inkjs/ui";
import type { DatalatheClient, DuckDBDatabase, DatabaseTable } from "@datalathe/client";
import { brand } from "../theme.js";

interface TreeNode {
  type: "database" | "table";
  name: string;
  databaseName: string;
  columnCount?: number;
}

interface DatabasesTreeProps {
  client: DatalatheClient;
  isFocused: boolean;
  onSelectTable: (databaseName: string, tableName: string) => void;
  height: number;
}

export function DatabasesTree({ client, isFocused, onSelectTable, height }: DatabasesTreeProps) {
  const [databases, setDatabases] = useState<DuckDBDatabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [schemas, setSchemas] = useState<Map<string, DatabaseTable[]>>(new Map());
  const [loadingDb, setLoadingDb] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  // Load databases
  useEffect(() => {
    client.getDatabases().then((dbs) => {
      setDatabases(dbs.filter((d) => !d.internal));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [client]);

  // Build flat list of visible nodes
  const nodes: TreeNode[] = [];
  for (const db of databases) {
    nodes.push({ type: "database", name: db.database_name, databaseName: db.database_name });
    if (expanded.has(db.database_name)) {
      const tables = schemas.get(db.database_name);
      if (tables) {
        const tableNames = [...new Set(tables.map((t) => `${t.schema_name}.${t.table_name}`))];
        for (const tn of tableNames) {
          const cols = tables.filter((t) => `${t.schema_name}.${t.table_name}` === tn);
          nodes.push({
            type: "table",
            name: tn,
            databaseName: db.database_name,
            columnCount: cols.length,
          });
        }
      }
    }
  }

  const toggleExpand = useCallback(async (dbName: string) => {
    if (expanded.has(dbName)) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(dbName);
        return next;
      });
    } else {
      if (!schemas.has(dbName)) {
        setLoadingDb(dbName);
        try {
          const schema = await client.getDatabaseSchema(dbName);
          setSchemas((prev) => new Map(prev).set(dbName, schema));
        } catch {
          // silently fail
        }
        setLoadingDb(null);
      }
      setExpanded((prev) => new Set(prev).add(dbName));
    }
  }, [client, expanded, schemas]);

  useInput((input, key) => {
    if (!isFocused || nodes.length === 0) return;

    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
    } else if (key.downArrow) {
      setCursor((c) => Math.min(nodes.length - 1, c + 1));
    } else if (key.return || key.rightArrow) {
      const node = nodes[cursor];
      if (node) {
        if (node.type === "database") {
          toggleExpand(node.databaseName);
        } else {
          onSelectTable(node.databaseName, node.name);
        }
      }
    } else if (key.leftArrow) {
      const node = nodes[cursor];
      if (node?.type === "database" && expanded.has(node.databaseName)) {
        toggleExpand(node.databaseName);
      }
    } else if (input === "r") {
      setLoading(true);
      setSchemas(new Map());
      setExpanded(new Set());
      client.getDatabases().then((dbs) => {
        setDatabases(dbs.filter((d) => !d.internal));
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  });

  // Keep cursor in bounds
  useEffect(() => {
    if (cursor >= nodes.length && nodes.length > 0) {
      setCursor(nodes.length - 1);
    }
  }, [cursor, nodes.length]);

  if (loading) {
    return <Spinner label="Loading..." />;
  }

  if (databases.length === 0) {
    return <Text color={brand.muted}>No databases</Text>;
  }

  // Scrollable window
  const maxVisible = Math.max(1, height - 1);
  let scrollOffset = 0;
  if (cursor >= scrollOffset + maxVisible) {
    scrollOffset = cursor - maxVisible + 1;
  }
  if (cursor < scrollOffset) {
    scrollOffset = cursor;
  }
  const visible = nodes.slice(scrollOffset, scrollOffset + maxVisible);

  return (
    <Box flexDirection="column">
      {visible.map((node, i) => {
        const globalIdx = scrollOffset + i;
        const isSelected = isFocused && globalIdx === cursor;
        const prefix = isSelected ? ">" : " ";

        if (node.type === "database") {
          const icon = expanded.has(node.databaseName) ? "▾" : "▸";
          const isLoading = loadingDb === node.databaseName;
          return (
            <Text key={`db-${node.name}`}>
              <Text color={isSelected ? brand.cyan : brand.muted}>{prefix} </Text>
              <Text color={isSelected ? brand.cyan : brand.text}>{icon} {node.name}</Text>
              {isLoading && <Text color={brand.muted}> ...</Text>}
            </Text>
          );
        }

        // table node
        const isLast = globalIdx + 1 >= nodes.length ||
          nodes[globalIdx + 1]?.type === "database";
        const connector = isLast ? "└" : "├";
        return (
          <Text key={`tbl-${node.databaseName}-${node.name}`}>
            <Text color={isSelected ? brand.cyan : brand.muted}>{prefix}   </Text>
            <Text color={brand.border}>{connector}─ </Text>
            <Text color={isSelected ? brand.cyan : brand.text}>{node.name}</Text>
            <Text color={brand.muted}> ({node.columnCount})</Text>
          </Text>
        );
      })}
      {nodes.length > maxVisible && (
        <Text color={brand.muted} dimColor>
          {" "}  {scrollOffset > 0 ? "↑" : " "} {scrollOffset + maxVisible < nodes.length ? "↓" : " "}
        </Text>
      )}
    </Box>
  );
}
