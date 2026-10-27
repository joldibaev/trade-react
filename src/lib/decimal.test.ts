import { describe, expect, it } from "vitest"

import {
  formatDecimal,
  isDecimal,
  decimalForInput,
  isZeroDecimal,
  parseDecimalInput,
} from "./decimal"

const nbsp = " "

describe("formatDecimal", () => {
  it("groups thousands with a no-break space and uses a decimal comma", () => {
    expect(formatDecimal("12500.00")).toBe(`12${nbsp}500,00`)
    expect(formatDecimal("-1234567.5")).toBe(`-1${nbsp}234${nbsp}567,5`)
  })

  it("keeps every fraction digit the API sent, even beyond what a JS number holds", () => {
    expect(formatDecimal("0.0001")).toBe("0,0001")
    expect(formatDecimal("90071992547409931.25")).toBe(
      `90${nbsp}071${nbsp}992${nbsp}547${nbsp}409${nbsp}931,25`
    )
  })

  it("leaves short and whole numbers alone", () => {
    expect(formatDecimal("100")).toBe("100")
    expect(formatDecimal("0.00")).toBe("0,00")
  })

  it("refuses text that is not a plain decimal", () => {
    for (const value of ["", "1e5", "12,5", "1 000", "+1", "abc", "1."]) {
      expect(isDecimal(value)).toBe(false)
      expect(() => formatDecimal(value)).toThrow()
    }
  })
})

describe("parseDecimalInput", () => {
  it("accepts what people type: spaces, a decimal comma, a dot", () => {
    expect(parseDecimalInput(`12${nbsp}500,5`, 2)).toBe("12500.5")
    expect(parseDecimalInput("12 500.50", 2)).toBe("12500.50")
    expect(parseDecimalInput("10", 3)).toBe("10")
    expect(parseDecimalInput("007", 2)).toBe("7")
    expect(parseDecimalInput("0,5", 2)).toBe("0.5")
  })

  it("refuses more fraction digits than the scale instead of rounding", () => {
    expect(parseDecimalInput("1,005", 2)).toBeNull()
    expect(parseDecimalInput("1.0001", 3)).toBeNull()
  })

  it("refuses anything that is not a non-negative number", () => {
    for (const input of ["", "-5", "1e3", "abc", "1.2.3", "1,2,3"])
      expect(parseDecimalInput(input, 2)).toBeNull()
  })
})

describe("isZeroDecimal", () => {
  it("tells zero from a small amount", () => {
    expect(isZeroDecimal("0.00")).toBe(true)
    expect(isZeroDecimal("0")).toBe(true)
    expect(isZeroDecimal("0.01")).toBe(false)
  })
})

describe("decimalForInput", () => {
  it("shows the API's value as a person types it", () => {
    expect(decimalForInput("12500.50")).toBe("12500,5")
    expect(decimalForInput("10.000")).toBe("10")
    expect(decimalForInput("100")).toBe("100")
    expect(decimalForInput("2.500")).toBe("2,5")
    expect(decimalForInput(null)).toBe("")
  })
})
