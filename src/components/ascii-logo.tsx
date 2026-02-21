import React from "react";
import { Box, Text } from "ink";
import { useTerminalSize } from "../hooks/use-terminal-size.js";
import { brand } from "../theme.js";

// The DataLathe logo art encoded as a character map:
// ' ' = empty, '=' = cyan bar, '*' = violet arc, '#'/'%' = indigo leaf
const LOGO_LINES = [
  "            ====================================              ******",
  "            ======================================          *************",
  "            =======================================        ******************",
  "            =======================================       **********************",
  "            =======================================       *************************",
  "              ====================================        ***************************",
  "                                                          *****************************",
  "                                                          *******************************",
  "                                                          *********************************",
  "===================================================       **********************************",
  "===================================================       ************************************",
  "===================================================       *************************************",
  "===================================================       **************************************",
  "===================================================       ***************************************",
  " =================================================        ****************************************",
  "                                                          ****************************************",
  "                                                          *****************************************",
  "               ====================================       ******************************************",
  "              =====================================       ******************************************",
  "              =====================================       ******************************************",
  "              =====================================       *****************************************",
  "              =====================================       *****************************************",
  "              =====================================       **************************************",
  "",
  "",
  "",
  "          ==================================           %#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%",
  "         ===================================         %############################################",
  "         ==================================        %###############################################",
  "         ================================        %#################################################%",
  "         ==============================         %##################################################%",
  "          ===========================         #####################################################%",
  "                                            %######################################################",
  "                                           #######################################################%",
  "                                         ########################################################%",
  "               ==============          ##########################################################",
  "              ==============         %#########################################################%",
  "              ============         %###########################################################",
  "              ==========          %###########################################################",
  "              ========          %###########################################################%",
  "               ======         %############################################################",
  "                            %%###########################################################%",
  "                           ############################################################%",
  "                         %############################################################",
  "                         ##########################################################%",
  "                        %#######################################################%%",
  "                         %####################################################%",
  "                         %################################################%",
  "                           %########################################%%",
];

// Normalize all lines to the same width
const SOURCE_WIDTH = Math.max(...LOGO_LINES.map((l) => l.length));
const SOURCE_HEIGHT = LOGO_LINES.length;
const PADDED_LINES = LOGO_LINES.map((l) => l.padEnd(SOURCE_WIDTH));

type ColorKey = "space" | "cyan" | "violet" | "indigo";

function charColor(ch: string): ColorKey {
  if (ch === "=") return "cyan";
  if (ch === "*") return "violet";
  if (ch === "#" || ch === "%") return "indigo";
  return "space";
}

const COLOR_HEX: Record<ColorKey, string | null> = {
  space: null,
  cyan: brand.cyan,
  violet: brand.violet,
  indigo: brand.indigo,
};

interface Segment {
  color: ColorKey;
  text: string;
}

function groupSegments(chars: ColorKey[]): Segment[] {
  const groups: Segment[] = [];
  for (const color of chars) {
    const display = color === "space" ? " " : "█";
    if (groups.length > 0 && groups[groups.length - 1]!.color === color) {
      groups[groups.length - 1]!.text += display;
    } else {
      groups.push({ color, text: display });
    }
  }
  return groups;
}

/** Downsample the logo to fit within targetWidth × targetHeight using nearest-neighbor. */
function scaleLogo(targetWidth: number, targetHeight: number): ColorKey[][] {
  const rows: ColorKey[][] = [];
  for (let r = 0; r < targetHeight; r++) {
    const srcRow = Math.floor((r / targetHeight) * SOURCE_HEIGHT);
    const srcLine = PADDED_LINES[srcRow] ?? "";
    const row: ColorKey[] = [];
    for (let c = 0; c < targetWidth; c++) {
      const srcCol = Math.floor((c / targetWidth) * SOURCE_WIDTH);
      row.push(charColor(srcLine[srcCol] ?? " "));
    }
    rows.push(row);
  }
  return rows;
}

/** Trim trailing space segments from a line for cleaner rendering. */
function trimTrailingSpaces(segments: Segment[]): Segment[] {
  while (segments.length > 0 && segments[segments.length - 1]!.color === "space") {
    segments.pop();
  }
  return segments;
}

export function AsciiLogo() {
  const { columns, rows: termRows } = useTerminalSize();

  // Scale logo to fit: use ~65% of terminal width, cap height at ~50% of rows
  // Leave room for the connect form below
  const maxWidth = Math.min(Math.floor(columns * 0.65), SOURCE_WIDTH);
  const maxHeight = Math.min(Math.floor(termRows * 0.50), SOURCE_HEIGHT);

  // Maintain aspect ratio (terminal chars are ~2:1 height:width)
  const scaleX = maxWidth / SOURCE_WIDTH;
  const scaleY = maxHeight / SOURCE_HEIGHT;
  const scale = Math.min(scaleX, scaleY);

  const targetWidth = Math.max(20, Math.round(SOURCE_WIDTH * scale));
  const targetHeight = Math.max(10, Math.round(SOURCE_HEIGHT * scale));

  const scaled = scaleLogo(targetWidth, targetHeight);

  return (
    <Box flexDirection="column">
      {scaled.map((row, i) => {
        const segments = trimTrailingSpaces(groupSegments(row));
        if (segments.length === 0) return <Text key={i}>{" "}</Text>;
        return (
          <Text key={i}>
            {segments.map((seg, j) => {
              const c = COLOR_HEX[seg.color];
              return c ? (
                <Text key={j} color={c}>{seg.text}</Text>
              ) : (
                <Text key={j}>{seg.text}</Text>
              );
            })}
          </Text>
        );
      })}
    </Box>
  );
}

// Compact inline wordmark for the header
export function LogoWordmark() {
  return (
    <Text>
      <Text color={brand.cyan} bold>{"Data"}</Text>
      <Text color={brand.violet} bold>{"Lathe"}</Text>
    </Text>
  );
}
