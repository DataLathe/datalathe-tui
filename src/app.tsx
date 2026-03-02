import React, { useState, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { DatalatheClient } from "@datalathe/client";
import { ClientContext } from "./hooks/use-client.js";
import { useNavigation } from "./hooks/use-navigation.js";
import { useTerminalSize } from "./hooks/use-terminal-size.js";
import { usePanelFocus } from "./hooks/use-panel-focus.js";
import { LogoWordmark } from "./components/ascii-logo.js";
import { Sidebar } from "./components/sidebar.js";
import { ConnectScreen } from "./screens/connect.js";
import { HomeScreen } from "./screens/home.js";
import { DatabaseTablesScreen } from "./screens/database-tables.js";
import { CreateChipScreen } from "./screens/create-chip.js";
import { CreateChipFromChipScreen } from "./screens/create-chip-from-chip.js";
import { ChipDetailScreen } from "./screens/chip-detail.js";
import { QueryScreen } from "./screens/query.js";
import { DeleteChipScreen } from "./screens/delete-chip.js";
import { brand } from "./theme.js";

const SCREEN_TITLES: Record<string, string> = {
  connect: "Connect",
  home: "Home",
  "database-tables": "Database Schema",
  "create-chip": "Create Chip",
  "create-chip-from-chip": "Create Chip from Chip",
  "chip-detail": "Chip Detail",
  query: "Query Chips",
  "delete-chip": "Delete Chip",
};

interface AppProps {
  url: string;
}

export function App({ url }: AppProps) {
  const { exit } = useApp();
  const [client, setClient] = useState<DatalatheClient | null>(null);
  const [connectedUrl, setConnectedUrl] = useState<string | null>(null);
  const [inputActive, setInputActive] = useState(false);
  const [checkedChipIds, setCheckedChipIds] = useState<string[]>([]);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const { current, navigate, goBack, goHome } = useNavigation("connect");
  const { columns, rows } = useTerminalSize();

  const isConnected = client !== null;
  const { activePanel, focusPanel } = usePanelFocus(inputActive);

  const handleConnect = useCallback(
    (newClient: DatalatheClient, connUrl: string) => {
      setClient(newClient);
      setConnectedUrl(connUrl);
      setInputActive(false);
      navigate("home");
    },
    [navigate],
  );

  // Global keys — only blocked when a TextInput is actively rendered
  useInput((input, key) => {
    if (inputActive) return;
    if (input === "q") {
      exit();
    }
    if (key.escape || input === "b") {
      if (current.screen === "home") {
        if (key.escape) exit();
      } else {
        goBack();
        focusPanel("main");
      }
    }
  });

  // Sidebar actions
  const handleSelectTable = useCallback(
    (databaseName: string, _tableName: string) => {
      navigate("database-tables", { databaseName });
      focusPanel("main");
    },
    [navigate, focusPanel],
  );

  const handleSelectChip = useCallback(
    (chipId: string) => {
      navigate("chip-detail", { chipId });
      focusPanel("main");
    },
    [navigate, focusPanel],
  );

  const handleChipDeleted = useCallback(() => {
    const deletedId = current.params.chipId as string;
    setCheckedChipIds((prev) => prev.filter((id) => id !== deletedId));
    setSidebarRefreshKey((k) => k + 1);
    goBack();
  }, [current.params.chipId, goBack]);

  const mainFocused = activePanel === "main";

  function renderScreen() {
    switch (current.screen) {
      case "home":
        return <HomeScreen onNavigate={(screen) => navigate(screen)} isFocused={mainFocused} />;
      case "database-tables":
        return (
          <DatabaseTablesScreen
            databaseName={current.params.databaseName as string}
            onCreateChip={(db, table) =>
              navigate("create-chip", { initialSource: db, initialTable: table })
            }
            onBack={goBack}
            isFocused={mainFocused}
          />
        );
      case "create-chip":
        return (
          <CreateChipScreen
            initialSource={current.params.initialSource as string | undefined}
            initialTable={current.params.initialTable as string | undefined}
            onDone={(chipId) => navigate("chip-detail", { chipId })}
            onBack={goBack}
            onInputActive={setInputActive}
          />
        );
      case "create-chip-from-chip":
        return (
          <CreateChipFromChipScreen
            defaultChipIds={current.params.sourceChipIds as string[] | undefined}
            onDone={(chipId) => {
              setSidebarRefreshKey((k) => k + 1);
              navigate("chip-detail", { chipId });
            }}
            onBack={goBack}
            onInputActive={setInputActive}
            isFocused={mainFocused}
          />
        );
      case "chip-detail":
        return (
          <ChipDetailScreen
            chipId={current.params.chipId as string}
            checkedChipIds={checkedChipIds}
            onQuery={(chipIds) => navigate("query", { queryChipIds: chipIds })}
            onCreateFromChip={(chipIds) => navigate("create-chip-from-chip", { sourceChipIds: chipIds })}
            onBack={goBack}
            onDeleted={handleChipDeleted}
            isFocused={mainFocused}
          />
        );
      case "delete-chip":
        return (
          <DeleteChipScreen
            onDone={() => {
              setSidebarRefreshKey((k) => k + 1);
              goHome();
            }}
            onBack={goBack}
            isFocused={mainFocused}
          />
        );
      case "query":
        return (
          <QueryScreen
            defaultChipIds={
              (current.params.queryChipIds as string[] | undefined) ??
              (checkedChipIds.length > 0 ? checkedChipIds : undefined)
            }
            onBack={goHome}
            onInputActive={setInputActive}
            isFocused={mainFocused}
          />
        );
      default:
        return <HomeScreen onNavigate={(screen) => navigate(screen)} isFocused={mainFocused} />;
    }
  }

  // Connect screen: fullscreen centered, no panels
  if (!isConnected) {
    return (
      <Box
        flexDirection="column"
        width={columns}
        height={rows}
        alignItems="center"
        justifyContent="center"
      >
        <ConnectScreen initialUrl={url} onConnect={handleConnect} />
      </Box>
    );
  }

  // Paneled layout
  const sidebarWidth = Math.min(50, Math.floor(columns * 0.38));
  const mainWidth = columns - sidebarWidth;
  const mainBorder = activePanel === "main" ? brand.cyan : brand.border;
  const screenTitle = SCREEN_TITLES[current.screen] ?? "";

  // Heights: total = rows, header = 1, status = 1, content = rest
  const contentHeight = rows - 2; // header line + status line

  return (
    <ClientContext.Provider value={client}>
      <Box flexDirection="column" width={columns} height={rows}>
        {/* Header bar */}
        <Box width={columns} justifyContent="space-between" paddingX={1}>
          <LogoWordmark />
          <Text color={brand.muted}>{screenTitle}</Text>
          <Text color={brand.muted}>{connectedUrl}</Text>
        </Box>

        {/* Main content area */}
        <Box flexDirection="row" height={contentHeight}>
          {/* Main panel */}
          <Box
            flexDirection="column"
            width={mainWidth}
            borderStyle="single"
            borderColor={mainBorder}
            overflow="hidden"
          >
            <Box
              flexDirection="column"
              paddingX={1}
              flexGrow={1}
              overflow="hidden"
            >
              {renderScreen()}
            </Box>
          </Box>

          {/* Sidebar */}
          <Sidebar
            client={client}
            activePanel={activePanel}
            width={sidebarWidth}
            height={contentHeight}
            checkedChipIds={checkedChipIds}
            onCheckedChipIdsChange={setCheckedChipIds}
            onSelectTable={handleSelectTable}
            onSelectChip={handleSelectChip}
            refreshKey={sidebarRefreshKey}
          />
        </Box>

        {/* Status bar */}
        <Box width={columns} justifyContent="space-between" paddingX={1}>
          <Text color={brand.muted}>
            <Text color={brand.cyan}>●</Text> {connectedUrl}
          </Text>
          <Text color={brand.muted} dimColor>
            Tab:panels  q:quit  b:back
          </Text>
        </Box>
      </Box>
    </ClientContext.Provider>
  );
}
