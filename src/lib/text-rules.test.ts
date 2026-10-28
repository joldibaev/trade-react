import { describe, expect, it } from "vitest"

import { nameError, textError, textLength } from "./text-rules"

const line = { max: 100 }
const lines = { max: 300, multiline: true }

describe("textError, as TradeNet's TextAttribute", () => {
  it("accepts a plain text, spaces inside included", () => {
    expect(textError("Тест UI 80", line)).toBeUndefined()
    expect(textError("a", line)).toBeUndefined()
  })

  it("refuses an empty text and one of only spaces", () => {
    expect(textError("", line)).toBe("REQUIRED")
    expect(textError("   ", line)).toBe("REQUIRED")
    expect(textError("\n", lines)).toBe("REQUIRED")
  })

  it("refuses a space at either end, a control or a format character", () => {
    expect(textError(" a", line)).toBe("INVALID_FORMAT")
    expect(textError("a ", line)).toBe("INVALID_FORMAT")
    expect(textError("a\tb", line)).toBe("INVALID_FORMAT")
    expect(textError("a\u200bb", line)).toBe("INVALID_FORMAT")
    expect(textError("a\u202eb", line)).toBe("INVALID_FORMAT")
  })

  it("allows a line break inside a multiline text only, never at its ends", () => {
    expect(textError("a\nb", lines)).toBeUndefined()
    expect(textError("a\nb", line)).toBe("INVALID_FORMAT")
    expect(textError("a\n", lines)).toBe("INVALID_FORMAT")
    expect(textError("\na", lines)).toBe("INVALID_FORMAT")
    expect(textError("a\r\nb", lines)).toBe("INVALID_FORMAT")
  })

  it("counts the characters of the NFC form", () => {
    // "й" as и + a combining breve is one character once normalized.
    const decomposed = "\u0438\u0306"
    expect(decomposed.length).toBe(2)
    expect(textLength(decomposed)).toBe(1)
    expect(textError(decomposed.repeat(100), line)).toBeUndefined()
    expect(textError(decomposed.repeat(101), line)).toBe("OUT_OF_RANGE")
  })
})

describe("nameError", () => {
  it("judges the trimmed name, up to 100 characters", () => {
    expect(nameError({ value: "  Карта  " })).toBeUndefined()
    expect(nameError({ value: "x".repeat(100) })).toBeUndefined()
    expect(nameError({ value: "x".repeat(101) })).toBe("OUT_OF_RANGE")
    expect(nameError({ value: "" })).toBe("REQUIRED")
    expect(nameError({ value: "a\u200bb" })).toBe("INVALID_FORMAT")
  })
})
