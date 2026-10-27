import { describe, expect, it } from "vitest"

import { kk } from "./messages/kk"
import { ru } from "./messages/ru"
import { uz } from "./messages/uz"

// The types already demand the same keys in every language; this catches what types cannot: a text left empty.
function emptyTexts(catalog: object, path = ""): string[] {
  return Object.entries(catalog).flatMap(([key, value]: [string, unknown]) => {
    const at = path ? `${path}.${key}` : key
    if (typeof value === "string") return value.trim() === "" ? [at] : []
    if (typeof value === "object" && value !== null)
      return emptyTexts(value, at)
    return []
  })
}

describe.each([
  ["ru", ru],
  ["uz", uz],
  ["kk", kk],
])("catalog %s", (_, catalog) => {
  it("has no empty text", () => {
    expect(emptyTexts(catalog)).toEqual([])
  })
})
