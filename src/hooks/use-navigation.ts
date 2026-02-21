import { useState, useCallback } from "react";

export type Screen =
  | "connect"
  | "home"
  | "database-tables"
  | "create-chip"
  | "chip-detail"
  | "query";

export interface NavigationState {
  screen: Screen;
  params: Record<string, unknown>;
}

export function useNavigation(initial: Screen = "connect") {
  const [history, setHistory] = useState<NavigationState[]>([
    { screen: initial, params: {} },
  ]);

  const current = history[history.length - 1];

  const navigate = useCallback(
    (screen: Screen, params: Record<string, unknown> = {}) => {
      setHistory((h) => [...h, { screen, params }]);
    },
    [],
  );

  const goBack = useCallback(() => {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  }, []);

  const goHome = useCallback(() => {
    setHistory([{ screen: "home", params: {} }]);
  }, []);

  return { current, navigate, goBack, goHome };
}
