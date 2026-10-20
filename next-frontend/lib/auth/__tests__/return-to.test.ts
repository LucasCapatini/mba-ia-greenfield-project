import { describe, expect, it } from "vitest"

import { loginHref, safeReturnTo } from "../return-to"

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

describe("loginHref", () => {
  it("keeps the slashes of the return path readable", () => {
    expect(loginHref("/watch/tech-01")).toBe("/login?returnTo=/watch/tech-01")
  })

  it("encodes the query of the return path so it stays inside returnTo", () => {
    expect(loginHref("/feed/subscriptions?cursor=a&b=1")).toBe(
      "/login?returnTo=/feed/subscriptions%3Fcursor%3Da%26b%3D1"
    )
  })
})
