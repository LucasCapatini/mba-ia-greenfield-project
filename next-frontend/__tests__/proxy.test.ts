import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const cookieMap = new Map<string, string>()

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (name: string) =>
      cookieMap.has(name) ? { name, value: cookieMap.get(name)! } : undefined,
    set: (name: string, value: string) => {
      cookieMap.set(name, value)
    },
    delete: (name: string) => {
      cookieMap.delete(name)
    },
  }),
}))

const { config, proxy } = await import("@/proxy")
const { setSession } = await import("@/lib/auth/session")

function requestTo(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3001"))
}

beforeEach(() => {
  cookieMap.clear()
})

describe("proxy", () => {
  it("guards the studio and the subscriptions feed", () => {
    expect(config.matcher).toEqual(["/studio/:path*", "/feed/:path*"])
  })

  it.each([
    ["/feed/subscriptions", "/login?returnTo=/feed/subscriptions"],
    ["/feed/subscriptions?cursor=abc", "/login?returnTo=/feed/subscriptions%3Fcursor%3Dabc"],
    ["/studio/videos", "/login?returnTo=/studio/videos"],
  ])("redirects %s without a session to %s", async (path, target) => {
    const response = await proxy(requestTo(path))

    expect(response.status).toBe(307)
    const location = new URL(response.headers.get("location")!)
    expect(`${location.pathname}${location.search}`).toBe(target)
  })

  it("lets a request with a session through", async () => {
    await setSession({
      accessToken: "active-at",
      refreshToken: "active-rt",
      userId: "u1",
      email: "studio@example.com",
      channelSlug: "studio_canal",
      channelName: "",
    })

    const response = await proxy(requestTo("/feed/subscriptions"))

    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })
})
