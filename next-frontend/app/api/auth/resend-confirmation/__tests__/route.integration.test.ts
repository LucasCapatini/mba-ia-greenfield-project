import { describe, it, expect, beforeAll } from "vitest";

let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ POST } = await import("@/app/api/auth/resend-confirmation/route"));
});

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/auth/resend-confirmation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/resend-confirmation", () => {
  it("returns 204 with no body and no cookie for a valid e-mail", async () => {
    const res = await POST(makeRequest({ email: "alice@example.com" }));

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("passes through 400 VALIDATION_ERROR for badrequest@example.com (reserved trigger)", async () => {
    const res = await POST(makeRequest({ email: "badrequest@example.com" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      statusCode: 400,
      error: "VALIDATION_ERROR",
    });
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
