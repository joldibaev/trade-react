import { describe, expect, it } from "vitest"

import { parseSearchText } from "./page"

describe("parseSearchText", () => {
  it("takes text trimmed, and nothing for empty or another type", () => {
    expect(parseSearchText("  Азиз ")).toBe("Азиз")
    expect(parseSearchText("   ")).toBeUndefined()
    expect(parseSearchText(undefined)).toBeUndefined()
    expect(parseSearchText(true)).toBeUndefined()
    expect(parseSearchText({ search: "x" })).toBeUndefined()
  })

  it("keeps the digits of a typed link, which the router reads as a number", () => {
    expect(parseSearchText(10001)).toBe("10001")
    expect(parseSearchText(98765432101234)).toBe("98765432101234")
  })
})
