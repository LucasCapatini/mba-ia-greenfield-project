import { describe, expect, it } from "vitest"

import { safeReturnTo } from "../return-to"

describe("safeReturnTo", () => {
  it.each([
    ["/studio/upload", "/studio/upload"],
    ["/studio/videos?status=draft&q=aula", "/studio/videos?status=draft&q=aula"],
    [["/studio/channel", "/other"], "/studio/channel"],
  ])("keeps the same-site path %j", (input, expected) => {
    expect(safeReturnTo(input)).toBe(expected)
  })

  it.each([
    undefined,
    null,
    "",
    "studio/upload",
    "//evil.example.com/x",
    "/\\evil.example.com",
    "https://evil.example.com",
    "javascript:alert(1)",
  ])("falls back to / for %j", (input) => {
    expect(safeReturnTo(input)).toBe("/")
  })
})
