import { describe, it, expect, beforeAll } from "vitest";

let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ POST } = await import("@/app/api/auth/reset-password/route"));
});

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/reset-password", () => {
  it("returns 204 with no body and no cookie for a valid token + password", async () => {
    const res = await POST(
      makeRequest({ token: "valid-token", new_password: "newpassword123" })
    );

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("passes through 401 TOKEN_EXPIRED with the upstream envelope intact", async () => {
    const res = await POST(
      makeRequest({ token: "expired-token", new_password: "newpassword123" })
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      statusCode: 401,
      error: "TOKEN_EXPIRED",
      message: expect.any(String),
    });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("passes through 401 INVALID_TOKEN", async () => {
    const res = await POST(
      makeRequest({ token: "invalid-token", new_password: "newpassword123" })
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      statusCode: 401,
      error: "INVALID_TOKEN",
    });
  });

  it("passes through 400 VALIDATION_ERROR", async () => {
    const res = await POST(
      makeRequest({ token: "badrequest-token", new_password: "short" })
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      statusCode: 400,
      error: "VALIDATION_ERROR",
    });
  });
});
