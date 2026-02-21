// This hook is no longer used - global keys are handled directly in app.tsx
// Kept for backwards compatibility if screens need it
import { useInput } from "ink";

interface GlobalKeysOptions {
  onQuit: () => void;
  onBack: () => void;
  inputActive?: boolean;
}

export function useGlobalKeys({
  onQuit,
  onBack,
  inputActive = false,
}: GlobalKeysOptions) {
  useInput((input, key) => {
    if (inputActive) return;
    if (input === "q") {
      onQuit();
    }
    if (key.escape || input === "b") {
      onBack();
    }
  });
}
