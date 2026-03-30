import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { TextInput, Select, Spinner } from "@inkjs/ui";
import { useClient } from "../hooks/use-client.js";
import { brand } from "../theme.js";
import type { ConnectionInfo } from "@datalathe/client";

type Step =
  | "list"
  | "action"
  | "add-alias"
  | "add-host"
  | "add-port"
  | "add-database"
  | "add-user"
  | "add-password"
  | "saving"
  | "testing"
  | "deleting";

const INPUT_STEPS: Step[] = ["add-alias", "add-host", "add-port", "add-database", "add-user", "add-password"];

interface ConnectionsScreenProps {
  onBack: () => void;
  onInputActive?: (active: boolean) => void;
}

export function ConnectionsScreen({ onBack, onInputActive }: ConnectionsScreenProps) {
  const client = useClient();
  const [step, setStep] = useState<Step>("list");
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // New connection form
  const [alias, setAlias] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("3306");
  const [database, setDatabase] = useState("");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");

  const [selectedAlias, setSelectedAlias] = useState<string | null>(null);

  useEffect(() => {
    onInputActive?.(INPUT_STEPS.includes(step));
    return () => onInputActive?.(false);
  }, [step, onInputActive]);

  const loadConnections = async () => {
    setLoading(true);
    setError(null);
    try {
      const conns = await client.listConnections();
      setConnections(conns);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load connections");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const resetForm = () => {
    setAlias("");
    setHost("");
    setPort("3306");
    setDatabase("");
    setUser("");
    setPassword("");
  };

  const handleSave = async () => {
    setStep("saving");
    setError(null);
    try {
      await client.upsertConnection(alias, { host, port, database, user, password });
      setMessage(`Connection '${alias}' saved`);
      resetForm();
      await loadConnections();
      setStep("list");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save connection");
      setStep("list");
    }
  };

  const handleTest = async (a: string) => {
    setStep("testing");
    setError(null);
    setMessage(null);
    try {
      const result = await client.testConnection(a);
      setMessage(`Connection '${a}': ${result.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed");
    }
    setStep("list");
  };

  const handleDelete = async (a: string) => {
    setStep("deleting");
    try {
      await client.deleteConnection(a);
      setMessage(`Connection '${a}' deleted`);
      await loadConnections();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
    setStep("list");
  };

  return (
    <Box flexDirection="column" gap={1} paddingY={1}>
      <Text color={brand.cyan} bold>
        Connections
      </Text>

      {loading && <Spinner label="Loading connections..." />}

      {step === "list" && !loading && (
        <Box flexDirection="column" gap={1}>
          {connections.length > 0 ? (
            <Box flexDirection="column">
              {connections.map((c) => (
                <Text key={c.alias}>
                  <Text color={brand.violet}>{c.alias}</Text>
                  <Text color={brand.muted}> → {c.user}@{c.host}:{c.port}/{c.database}</Text>
                </Text>
              ))}
            </Box>
          ) : (
            <Text color={brand.muted}>No connections configured</Text>
          )}

          {message && <Text color={brand.success}>{message}</Text>}
          {error && <Text color={brand.error}>{error}</Text>}

          <Select
            options={[
              { label: "Add Connection", value: "add" },
              ...(connections.length > 0
                ? [
                    { label: "Test Connection", value: "test" },
                    { label: "Delete Connection", value: "delete" },
                  ]
                : []),
              { label: "Back", value: "back" },
            ]}
            onChange={(value) => {
              setMessage(null);
              setError(null);
              if (value === "add") {
                resetForm();
                setStep("add-alias");
              } else if (value === "test" || value === "delete") {
                setSelectedAlias(null);
                setStep("action");
                // Store action type in a hacky way via selectedAlias prefix
                setSelectedAlias(value);
              } else {
                onBack();
              }
            }}
          />
        </Box>
      )}

      {step === "action" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Select connection:</Text>
          <Select
            options={connections.map((c) => ({
              label: `${c.alias} (${c.host}:${c.port})`,
              value: c.alias,
            }))}
            onChange={(value) => {
              if (selectedAlias === "test") {
                handleTest(value);
              } else {
                handleDelete(value);
              }
            }}
          />
        </Box>
      )}

      {step === "add-alias" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.text}>Connection alias:</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput placeholder="my-mysql" onSubmit={(v) => { if (v.trim()) { setAlias(v.trim()); setStep("add-host"); } }} />
          </Box>
        </Box>
      )}

      {step === "add-host" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.muted}>Alias: {alias}</Text>
          <Text color={brand.text}>Host:</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput placeholder="db.example.com" onSubmit={(v) => { if (v.trim()) { setHost(v.trim()); setStep("add-port"); } }} />
          </Box>
        </Box>
      )}

      {step === "add-port" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.muted}>Alias: {alias} · Host: {host}</Text>
          <Text color={brand.text}>Port:</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput defaultValue="3306" onSubmit={(v) => { setPort(v.trim() || "3306"); setStep("add-database"); }} />
          </Box>
        </Box>
      )}

      {step === "add-database" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.muted}>Alias: {alias} · Host: {host}:{port}</Text>
          <Text color={brand.text}>Database:</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput placeholder="main" onSubmit={(v) => { if (v.trim()) { setDatabase(v.trim()); setStep("add-user"); } }} />
          </Box>
        </Box>
      )}

      {step === "add-user" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.muted}>Alias: {alias} · {host}:{port}/{database}</Text>
          <Text color={brand.text}>User:</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput placeholder="root" onSubmit={(v) => { if (v.trim()) { setUser(v.trim()); setStep("add-password"); } }} />
          </Box>
        </Box>
      )}

      {step === "add-password" && (
        <Box flexDirection="column" gap={1}>
          <Text color={brand.muted}>Alias: {alias} · {user}@{host}:{port}/{database}</Text>
          <Text color={brand.text}>Password:</Text>
          <Box>
            <Text color={brand.violet}>{"❯ "}</Text>
            <TextInput placeholder="••••••••" onSubmit={(v) => { setPassword(v); handleSave(); }} />
          </Box>
        </Box>
      )}

      {step === "saving" && <Spinner label="Saving connection..." />}
      {step === "testing" && <Spinner label="Testing connection..." />}
      {step === "deleting" && <Spinner label="Deleting connection..." />}
    </Box>
  );
}
