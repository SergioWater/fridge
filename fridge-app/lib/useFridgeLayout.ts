import { useState, useRef, useEffect } from "react";

const GRID_THRESHOLD = 15;

/**
 * Returns the layout mode for the Fridge tab.
 * Sticky upward: once the fridge hits GRID_THRESHOLD active items the mode
 * becomes "grid" and stays "grid" for the session even if count dips back
 * below the threshold — no flip-flopping.
 */
export function useFridgeLayout(itemCount: number): "list" | "grid" {
  const [mode, setMode] = useState<"list" | "grid">("list");
  const hasGoneGrid = useRef(false);

  useEffect(() => {
    if (!hasGoneGrid.current && itemCount >= GRID_THRESHOLD) {
      hasGoneGrid.current = true;
      setMode("grid");
    }
  }, [itemCount]);

  return mode;
}
