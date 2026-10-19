import { describe, expect, it } from "vitest";

import { formatCompactNumber, formatDate, formatDuration, formatRelativeTime } from "../format";

describe("formatDate", () => {
  it("formats an ISO string as a medium date in UTC", () => {
    expect(formatDate("2026-10-17T12:00:00Z")).toBe("Oct 17, 2026");
    expect(formatDate("2026-10-17T23:30:00Z")).toBe("Oct 17, 2026");
  });

  it("accepts a Date", () => {
    expect(formatDate(new Date("2026-01-02T00:00:00Z"))).toBe("Jan 2, 2026");
  });
});

describe("formatCompactNumber", () => {
  it.each([
    [0, "0"],
    [432, "432"],
    [1200, "1.2K"],
    [5200, "5.2K"],
    [124000, "124K"],
    [1_200_000, "1.2M"],
  ])("formats %d as %s", (value, expected) => {
    expect(formatCompactNumber(value)).toBe(expected);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [630, "10:30"],
    [3600, "1:00:00"],
    [3725, "1:02:05"],
    [59.6, "1:00"],
  ])("formats %d seconds as %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it("returns null for negative or non-finite input", () => {
    expect(formatDuration(-1)).toBeNull();
    expect(formatDuration(Number.NaN)).toBeNull();
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-10-19T12:00:00Z");

  it.each([
    ["2026-10-19T11:59:30Z", "just now"],
    ["2026-10-19T11:55:00Z", "5 minutes ago"],
    ["2026-10-19T09:00:00Z", "3 hours ago"],
    ["2026-10-18T12:00:00Z", "1 day ago"],
    ["2026-10-17T12:00:00Z", "2 days ago"],
    ["2026-10-05T12:00:00Z", "2 weeks ago"],
    ["2026-07-19T12:00:00Z", "3 months ago"],
    ["2024-10-19T12:00:00Z", "2 years ago"],
  ])("formats %s as %s", (iso, expected) => {
    expect(formatRelativeTime(iso, now)).toBe(expected);
  });

  it("treats future dates as just now", () => {
    expect(formatRelativeTime("2026-10-20T12:00:00Z", now)).toBe("just now");
  });
});
