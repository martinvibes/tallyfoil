import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  daysBetween,
  endOfMonth,
  findDatesInText,
  formatLongDate,
  periodLabel,
} from "./dates";

describe("date arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2027-01-31", -60)).toBe("2026-12-02");
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("adds months, clamping to the end of shorter months", () => {
    expect(addMonths("2026-02-01", 12)).toBe("2027-02-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("counts whole days between two dates", () => {
    expect(daysBetween("2026-11-09", "2026-12-02")).toBe(23);
    expect(daysBetween("2026-12-03", "2026-12-02")).toBe(-1);
  });

  it("finds the last day of a month, including leap years", () => {
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(endOfMonth("2028-02-01")).toBe("2028-02-29");
  });
});

describe("labels", () => {
  it("names a full calendar month by month and year", () => {
    expect(periodLabel("2026-02-01", "2026-02-28")).toBe("February 2026");
  });

  it("names any other range by its two dates", () => {
    expect(periodLabel("2026-02-15", "2026-03-14")).toBe("15 Feb 2026 – 14 Mar 2026");
  });

  it("formats a single date day-first", () => {
    expect(formatLongDate("2026-12-02")).toBe("2 Dec 2026");
  });
});

describe("findDatesInText", () => {
  it("reads ISO dates and dates written in words", () => {
    expect(findDatesInText("Invoice Date: 2026-07-06")).toEqual(["2026-07-06"]);
    expect(findDatesInText("February 1, 2025 through January 31, 2026")).toEqual(["2025-02-01", "2026-01-31"]);
    expect(findDatesInText("starts 1 July 2026, ends 30 Sept. 2026")).toEqual(["2026-07-01", "2026-09-30"]);
    expect(findDatesInText("signed on the 3rd of March 2026")).toEqual(["2026-03-03"]);
  });

  it("ignores impossible dates", () => {
    expect(findDatesInText("February 30, 2026 or 2026-13-01")).toEqual([]);
  });
});
