import { describe, expect, it } from "vitest"

import { safeRedirect } from "./session"

describe("safeRedirect", () => {
  it("keeps a path of this app", () => {
    expect(safeRedirect("/products?search=ручка")).toBe(
      "/products?search=ручка"
    )
  })

  it("drops anything that would leave the app", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "javascript:alert(1)",
      42,
      undefined,
    ]) {
      expect(safeRedirect(value)).toBeUndefined()
    }
  })
})
