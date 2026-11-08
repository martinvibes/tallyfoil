import { describe, expect, it } from "vitest";

import { excerpt } from "./excerpt";

const text = ["line one", "line two", "Seats 48 USD 26.16", "line four", "line five", "line six"].join("\n");
const start = text.indexOf("48 USD 26.16");
const end = start + "48 USD 26.16".length;

describe("excerpt", () => {
  it("returns whole lines around the quote with the highlight offsets inside them", () => {
    const result = excerpt(text, start, end, 1);
    expect(result.text).toBe("line two\nSeats 48 USD 26.16\nline four");
    expect(result.firstLine).toBe(2);
    expect(result.text.slice(result.highlightStart, result.highlightEnd)).toBe("48 USD 26.16");
  });

  it("stops at the edges of the document", () => {
    const result = excerpt(text, 0, 4, 3);
    expect(result.firstLine).toBe(1);
    expect(result.text.split("\n")).toHaveLength(4);
    expect(result.text.slice(result.highlightStart, result.highlightEnd)).toBe("line");
  });

  it("clamps offsets that no longer fit the text", () => {
    const result = excerpt("short", 2, 99, 0);
    expect(result.text.slice(result.highlightStart, result.highlightEnd)).toBe("ort");
  });
});
