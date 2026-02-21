import { useState, useCallback } from "react";
import { useInput } from "ink";

export type Panel = "main" | "databases" | "chips";

const PANEL_ORDER: Panel[] = ["main", "databases", "chips"];

export function usePanelFocus(inputActive = false) {
  const [activePanel, setActivePanel] = useState<Panel>("main");

  const focusNext = useCallback(() => {
    setActivePanel((cur) => {
      const idx = PANEL_ORDER.indexOf(cur);
      return PANEL_ORDER[(idx + 1) % PANEL_ORDER.length];
    });
  }, []);

  const focusPrevious = useCallback(() => {
    setActivePanel((cur) => {
      const idx = PANEL_ORDER.indexOf(cur);
      return PANEL_ORDER[(idx - 1 + PANEL_ORDER.length) % PANEL_ORDER.length];
    });
  }, []);

  const focusPanel = useCallback((panel: Panel) => {
    setActivePanel(panel);
  }, []);

  useInput((input, key) => {
    if (inputActive) return;
    if (key.tab && key.shift) {
      focusPrevious();
    } else if (key.tab) {
      focusNext();
    }
  });

  return { activePanel, focusNext, focusPrevious, focusPanel };
}
