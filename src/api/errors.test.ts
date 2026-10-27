import { describe, expect, it } from "vitest"

import { toApiError } from "./errors"

const problemJson = { "Content-Type": "application/problem+json" }

describe("toApiError", () => {
  it("takes the code, field codes and support id from a problem body", () => {
    const body = {
      title: "One or more validation errors occurred.",
      status: 400,
      code: "VALIDATION_ERROR",
      traceId: "00-abc-01",
      errors: { login: ["REQUIRED"] },
    }
    const error = toApiError(
      new Response(null, { status: 400, headers: problemJson }),
      body
    )

    expect(error.code).toBe("VALIDATION_ERROR")
    expect(error.fieldErrors).toEqual({ login: ["REQUIRED"] })
    expect(error.problem?.traceId).toBe("00-abc-01")
  })

  it("reads Retry-After seconds", () => {
    const body = {
      title: "Too many",
      status: 429,
      code: "TOO_MANY_LOGIN_ATTEMPTS",
      traceId: "t",
    }
    const response = new Response(null, {
      status: 429,
      headers: { ...problemJson, "Retry-After": "42" },
    })

    expect(toApiError(response, body).retryAfter).toBe(42)
  })

  it("reads a proxy's plain 502 as the server being unavailable", () => {
    const error = toApiError(
      new Response(null, { status: 502 }),
      "<html>Bad Gateway</html>"
    )

    expect(error.code).toBe("SERVICE_UNAVAILABLE")
    expect(error.problem).toBeNull()
  })

  it("calls any other answer without a problem body unexpected", () => {
    const error = toApiError(new Response(null, { status: 404 }), "Not Found")

    expect(error.code).toBe("UNEXPECTED_RESPONSE")
  })
})
