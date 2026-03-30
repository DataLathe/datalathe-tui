import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { brand } from "../theme.js";

export interface MenuOption {
  label: string;
  value: string;
  description?: string;
}

interface MenuSelectProps {
  options: MenuOption[];
  onChange: (value: string) => void;
  visibleCount?: number;
  isDisabled?: boolean;
}

export function MenuSelect({
  options,
  onChange,
  visibleCount,
  isDisabled = false,
}: MenuSelectProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const maxVisible = visibleCount ?? options.length;
  const [scrollOffset, setScrollOffset] = useState(0);

  useInput(
    (_input, key) => {
      if (key.downArrow) {
        setFocusedIndex((prev) => {
          const next = Math.min(prev + 1, options.length - 1);
          // Scroll down if needed
          if (next >= scrollOffset + maxVisible) {
            setScrollOffset(next - maxVisible + 1);
          }
          return next;
        });
      }
      if (key.upArrow) {
        setFocusedIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          // Scroll up if needed
          if (next < scrollOffset) {
            setScrollOffset(next);
          }
          return next;
        });
      }
      if (key.return) {
        onChange(options[focusedIndex]!.value);
      }
    },
    { isActive: !isDisabled },
  );

  const hasMore = options.length > maxVisible;
  const canScrollUp = scrollOffset > 0;
  const canScrollDown = scrollOffset + maxVisible < options.length;
  const visibleOptions = options.slice(scrollOffset, scrollOffset + maxVisible);

  return (
    <Box flexDirection="column">
      {hasMore && canScrollUp && (
        <Text color={brand.muted} dimColor>
          {"  "}↑ more
        </Text>
      )}
      {visibleOptions.map((option, i) => {
        const realIndex = scrollOffset + i;
        const focused = realIndex === focusedIndex;
        return (
          <Box key={option.value}>
            <Text color={focused ? brand.cyan : brand.text}>
              {focused ? "❯ " : "  "}
              {option.label}
            </Text>
            {option.description && (
              <Text color={brand.muted}> {option.description}</Text>
            )}
          </Box>
        );
      })}
      {hasMore && canScrollDown && (
        <Text color={brand.muted} dimColor>
          {"  "}↓ more
        </Text>
      )}
    </Box>
  );
}
