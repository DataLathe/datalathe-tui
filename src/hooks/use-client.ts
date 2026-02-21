import { createContext, useContext } from "react";
import type { DatalatheClient } from "@datalathe/client";

export const ClientContext = createContext<DatalatheClient | null>(null);

export function useClient(): DatalatheClient {
  const client = useContext(ClientContext);
  if (!client) {
    throw new Error("useClient must be used within a ClientContext provider");
  }
  return client;
}
