import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import * as fs from "node:fs";
import * as path from "node:path";
import { brand } from "../theme.js";

interface FilePathInputProps {
  onSubmit: (value: string) => void;
}

function getCompletions(input: string): string[] {
  try {
    const dir = input.endsWith("/") ? input : path.dirname(input);
    const prefix = input.endsWith("/") ? "" : path.basename(input);
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.name.startsWith(prefix))
      .map((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? full + "/" : full;
      })
      .sort();
  } catch {
    return [];
  }
}

function commonPrefix(strings: string[]): string {
  if (strings.length === 0) return "";
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix;
}

export function FilePathInput({ onSubmit }: FilePathInputProps) {
  const [value, setValue] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const [completions, setCompletions] = useState<string[]>([]);

  const handleTab = useCallback(() => {
    const matches = getCompletions(value);
    if (matches.length === 1) {
      setValue(matches[0]);
      setCursorPos(matches[0].length);
      setCompletions([]);
    } else if (matches.length > 1) {
      const shared = commonPrefix(matches);
      if (shared.length > value.length) {
        setValue(shared);
        setCursorPos(shared.length);
      }
      setCompletions(matches.slice(0, 5));
    } else {
      setCompletions([]);
    }
  }, [value]);

  useInput((input, key) => {
    if (key.return) {
      if (value.trim()) onSubmit(value);
      return;
    }

    if (key.tab) {
      handleTab();
      return;
    }

    if (key.backspace || key.delete) {
      if (cursorPos > 0) {
        const next = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
        setValue(next);
        setCursorPos(cursorPos - 1);
        setCompletions([]);
      }
      return;
    }

    if (key.leftArrow) {
      setCursorPos(Math.max(0, cursorPos - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPos(Math.min(value.length, cursorPos + 1));
      return;
    }

    // Ignore control keys
    if (key.ctrl || key.meta || key.escape || key.upArrow || key.downArrow) {
      return;
    }

    if (input) {
      const next = value.slice(0, cursorPos) + input + value.slice(cursorPos);
      setValue(next);
      setCursorPos(cursorPos + input.length);
      setCompletions([]);
    }
  });

  // Render the value with a cursor indicator
  const before = value.slice(0, cursorPos);
  const cursorChar = value[cursorPos] ?? " ";
  const after = value.slice(cursorPos + 1);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={brand.violet}>{"❯ "}</Text>
        <Text color={brand.text}>{before}</Text>
        <Text backgroundColor={brand.violet} color={brand.text}>
          {cursorChar}
        </Text>
        <Text color={brand.text}>{after}</Text>
        {value.length === 0 && (
          <Text color={brand.muted}>/path/to/file.csv</Text>
        )}
      </Box>
      {completions.length > 0 && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {completions.map((c) => (
            <Text key={c} color={brand.muted}>
              {c}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
