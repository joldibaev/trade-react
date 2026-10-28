import { describe, expect, it } from "vitest"

import {
  barcodeFormat,
  barcodeSvg,
  hasValidEanCheckDigit,
  moduleDots,
  printerDotMm,
} from "./barcode"

describe("EAN check digit", () => {
  it("accepts the codes TradeNet generates and real ones", () => {
    expect(hasValidEanCheckDigit("2000000054056")).toBe(true)
    expect(hasValidEanCheckDigit("2000000000015")).toBe(true)
    expect(hasValidEanCheckDigit("4780000000014")).toBe(true)
    expect(hasValidEanCheckDigit("96385074")).toBe(true)
  })

  it("refuses a wrong check digit", () => {
    expect(hasValidEanCheckDigit("2000000054057")).toBe(false)
  })
})

describe("barcode format", () => {
  it("prints EAN-13 and EAN-8 only when the check digit is right", () => {
    expect(barcodeFormat("2000000054056")).toBe("EAN13")
    expect(barcodeFormat("96385074")).toBe("EAN8")
    expect(barcodeFormat("2000000054057")).toBe("CODE128")
    expect(barcodeFormat("ABC-123")).toBe("CODE128")
  })
})

describe("bars in whole printer dots", () => {
  it("takes the widest whole number of dots that fits", () => {
    // EAN-13: 95 modules + 18 of quiet zones in 55 mm at 203 dpi: 3.89 dots → 3.
    expect(moduleDots(113, 55)).toBe(3)
    expect(moduleDots(113, 10)).toBeNull()
  })

  it("draws an EAN-13 whose every module is three dots, quiet zones included", () => {
    const svg = barcodeSvg(document, "2000000054056", 55, 12)
    expect(svg?.getAttribute("viewBox")).toBe("-11 0 113 100")
    expect(svg?.getAttribute("shape-rendering")).toBe("crispEdges")
    expect(svg?.style.width).toBe(`${String(113 * 3 * printerDotMm)}mm`)
  })

  it("gives up on bars that cannot fit even one dot per module: the label prints the digits", () => {
    expect(barcodeSvg(document, "2000000054056", 10, 12)).toBeNull()
  })
})
