import { describe, it, expect } from "vitest";
import { scrollWindow } from "../src/utils/chip-options.js";

describe("scrollWindow", () => {
  it("returns the whole list with no indicator when it fits", () => {
    expect(scrollWindow(3, 10, 0)).toEqual({ start: 0, end: 3, indicator: "" });
  });

  it("caps the window at the top of an overflowing list", () => {
    const w = scrollWindow(143, 20, 0);
    expect(w.start).toBe(0);
    expect(w.end).toBe(20);
    expect(w.indicator).toBe("  1-20/143 ↓");
  });

  it("shows both arrows when scrolled into the middle", () => {
    const w = scrollWindow(143, 20, 20);
    expect(w.start).toBe(20);
    expect(w.end).toBe(40);
    expect(w.indicator).toBe("↑ 21-40/143 ↓");
  });

  it("clamps the offset to the last page at the bottom", () => {
    const w = scrollWindow(143, 20, 999);
    expect(w.start).toBe(123);
    expect(w.end).toBe(143);
    expect(w.indicator).toBe("↑ 124-143/143  ");
  });

  it("clamps a negative offset to zero", () => {
    expect(scrollWindow(143, 20, -5).start).toBe(0);
  });
});
